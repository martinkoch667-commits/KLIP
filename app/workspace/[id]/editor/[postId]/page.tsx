'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Circle,
  Group,
  Image as KonvaImage,
  Layer,
  Line,
  Rect,
  Shape as KonvaShape,
  Stage,
  Star as KonvaStar,
  Text,
} from 'react-konva';
import useImage from 'use-image';
import Konva from 'konva';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import ColorPicker from '@/components/ColorPicker';
import SelectionOverlay, { getVisualRect } from '@/components/SelectionOverlay';
import Sidebar from '@/components/Sidebar';
import { TEXT_TEMPLATES, TT_CATS, TT_REF_W, TextTemplateThumb, adaptTemplateToCharter, type BrandKit, type TextTemplate } from './textTemplates';
import { LAYOUT_TEMPLATES, LAYOUT_CATS, LAYOUT_STYLES, LayoutThumb, adaptLayoutToCharter, type LayoutTemplate } from './layoutTemplates';
import { googleVariants, weightName } from '@/lib/fontWeights';
import { fontCssHrefs, CATALOG_FAMILIES } from '@/lib/fontCatalog';
import { resolveFonts } from '@/lib/designSystem';
import { buildCarouselSlide, themeFromBrand } from '@/lib/carouselDesigns';
import { registerFontFamily, weightLabel, type FontFamily } from '@/lib/fontFiles';
import { isTextEntry } from '@/lib/keys';
import { STICKERS, STICKER_CATS, stickerDataUri, type Sticker } from './stickers';
import { AiThinkingLog } from '@/components/AiThinkingPanel';
import AiChatDock from '@/components/AiChatDock';
import KlipMark from '@/components/KlipMark';
import RichTextOverlay, { type RichTextHandle } from '@/components/RichTextOverlay';
import {
  blockStyleOf, clearTextMetricsCache, isRunKey, layoutText,
  measureBlock, measureSegment, stripRunKeys, styleOfRange,
  type ResolvedStyle, type TextRun,
} from '@/lib/richText';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Slide {
  id: string;
  elements: CanvasEl[];
  proxyUrl: string;
  bgOffsetX?: number; // pixel offset of scaled bg image (cover behavior)
  bgOffsetY?: number;
  thumbnail?: string;
  spanGroupId?: string; // regroupe les slides d'un même visuel "étendu" (panorama continu)
  spanIndex?: number;   // position (0 = ancre) dans le groupe, pour recalcul futur éventuel
}

interface BaseEl { id: string; x: number; y: number; rotation: number; opacity: number; }
interface TextEl extends BaseEl {
  type: 'text'; text: string; fontSize: number; fontFamily: string; fontStyle: string;
  /** Rôle typographique d'origine (`display`, `body`, `condensed`, `serif`,
   *  `script`) quand le calque a été écrit par le système de design. Tant qu'il
   *  est là, la police suit la charte du client ; choisir une police à la main
   *  l'efface, et le choix est alors définitif. */
  fontRole?: string;
  textDecoration: string; fill: string; align: string; width: number;
  // Stylisation partielle : chaque run porte un intervalle [start, end) sur
  // `text` et les propriétés qui écrasent celles du bloc. Absent = calque
  // uniforme.
  runs?: TextRun[];
  fillType?: 'color' | 'gradient'; fillTo?: string; fillAngle?: number;
  hasBg: boolean; bgColor: string; bgOpacity: number; cornerRadius: number;
  padding: number; paddingH: number; paddingV: number;
  role?: string;
  // Champ nommé par l'auteur du template (role === 'personnalise') : « Nom du
  // journal », « Horaires »… — ce que ce bloc contiendra toujours.
  roleLabel?: string;
  roleHint?: string;
  /** Texte que le modèle portait à cet endroit, avant remplissage par l'IA.
   *  Sert de référence de silhouette : c'est le nombre de lignes qu'il occupait
   *  qu'on cherche à retrouver (cf. relayoutText). */
  origText?: string;
  maxLines?: number;
  /** Largeur VOULUE par le dessin : le re-calage n'a pas le droit de l'élargir.
   *  Sans ce verrou, un titre un peu long dans une colonne étroite s'étalait sur
   *  toute la page — et la composition en colonne n'existait plus. */
  lockWidth?: boolean;
  minFontSize?: number;
  maxFontSize?: number;
  lineHeight?: number;
  letterSpacing?: number;
  uppercase?: boolean;
  shadowEnabled?: boolean;
  shadowColor?: string;
  shadowOpacity?: number; // 0-100, default 75
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  stroke?: string;
  strokeWidth?: number;
  // Highlight
  highlightEnabled?: boolean;
  highlightColor?: string;
  highlightOpacity?: number; // 0-100, default 80
  highlightBorderRadius?: number; // default 4
  highlightPadding?: number; // default 8
  // Glow
  glowEnabled?: boolean;
  glowColor?: string;
  glowIntensity?: number; // 0-100, default 50
  glowSize?: number; // default 10
  // Hollow
  hollowEnabled?: boolean;
  // Lift
  liftEnabled?: boolean;
  liftColor?: string;
  liftDepth?: number; // default 6
  liftDirection?: string; // 'tl'|'t'|'tr'|'l'|'r'|'bl'|'b'|'br', default 'br'
  // Echo
  echoEnabled?: boolean;
  echoColor?: string;
  echoCount?: number; // 1-5, default 3
  echoOffset?: number; // default 8
  echoFade?: boolean; // default true
}
interface RectEl extends BaseEl { type: 'rect'; width: number; height: number; fill: string; fillType?: 'color' | 'gradient'; fillTo?: string; fillAngle?: number; stroke: string; strokeWidth: number; cornerRadius: number; scrim?: 'bottom' | 'top'; }
interface CircleEl extends BaseEl { type: 'circle'; radius: number; fill: string; fillType?: 'color' | 'gradient'; fillTo?: string; fillAngle?: number; stroke: string; strokeWidth: number; }
interface StarEl extends BaseEl { type: 'star'; numPoints: number; innerRadius: number; outerRadius: number; fill: string; fillType?: 'color' | 'gradient'; fillTo?: string; fillAngle?: number; stroke: string; strokeWidth: number; }
interface AnchorPoint { x: number; y: number; cpIn?: { x: number; y: number }; cpOut?: { x: number; y: number }; }
interface VectorEl extends BaseEl { type: 'vector'; shape: 'rectangle'|'circle'|'triangle'|'star'|'pill'|'arrow'|'diamond'|'hexagon'|'custom'; width: number; height: number;
  /** Arrondi des coins, pour les formes qui en ont (rectangle). */
  cornerRadius?: number; fill: string; fillType?: 'color'|'none'|'image'|'gradient'; fillTo?: string; fillAngle?: number; stroke: string; strokeWidth: number; points?: AnchorPoint[]; closed?: boolean; imageSrc?: string; imageOffsetX?: number; imageOffsetY?: number; }
interface ImageEl extends BaseEl { type: 'image'; src: string; width: number; height: number; cropX?: number; cropY?: number; naturalW?: number; naturalH?: number;
  // Zoom de l'image DANS son cadre, figé indépendamment de la taille du cadre —
  // sans lui, redimensionner via une seule poignée (haut/bas notamment) faisait
  // « zoomer » l'image au lieu de simplement révéler/masquer du cadre, puisque
  // l'échelle « cover » se recalculait à chaque frame à partir de la largeur ET
  // de la hauteur courantes. Absent (images déjà existantes) → calculé et figé
  // au premier redimensionnement (cf. ImgNode/SelectionOverlay).
  imgScale?: number;
  // Arrondi des quatre coins du cadre (px). Absent = coins nets.
  cornerRadius?: number;
  // Ajustements colorimétriques (chacun -100..100, 0 = neutre ; flou 0..100)
  adjBrightness?: number; adjContrast?: number; adjSaturation?: number; adjWarmth?: number; adjTint?: number; adjBlur?: number; }
type CanvasEl = TextEl | RectEl | CircleEl | StarEl | VectorEl | ImageEl;

// ─── Constants ────────────────────────────────────────────────────────────────

// ─── Template background ──────────────────────────────────────────────────────

interface BgStyle {
  type: 'gradient' | 'solid';
  color?: string;
  angle?: number;
  colorFrom?: string;
  colorTo?: string;
}

const PHOTO_PLACEHOLDER_SRC = '__PHOTO_PLACEHOLDER__';

// Props de dégradé linéaire Konva génériques, réutilisables sur n'importe quelle
// forme (Rect/Circle/Star/Text/KonvaShape) — même géométrie angle->points que
// BgStyleLayer, appliquée à la boîte englobante locale de l'élément (w×h).
function gradientFillProps(w: number, h: number, angle: number, colorFrom: string, colorTo: string) {
  const angleRad = (angle * Math.PI) / 180;
  const dx = Math.cos(angleRad);
  const dy = Math.sin(angleRad);
  return {
    fillLinearGradientStartPoint: { x: w * Math.max(0, -dx), y: h * Math.max(0, -dy) },
    fillLinearGradientEndPoint: { x: w * Math.max(0, dx), y: h * Math.max(0, dy) },
    fillLinearGradientColorStops: [0, colorFrom, 1, colorTo],
  };
}
// Variante pour formes centrées sur leur origine locale (Circle/Star dans Konva).
function gradientFillPropsCentered(r: number, angle: number, colorFrom: string, colorTo: string) {
  const angleRad = (angle * Math.PI) / 180;
  const dx = Math.cos(angleRad) * r;
  const dy = Math.sin(angleRad) * r;
  return {
    fillLinearGradientStartPoint: { x: -dx, y: -dy },
    fillLinearGradientEndPoint: { x: dx, y: dy },
    fillLinearGradientColorStops: [0, colorFrom, 1, colorTo],
  };
}

function BgStyleLayer({ bgStyle, w, h }: { bgStyle: BgStyle; w: number; h: number }) {
  if (bgStyle.type === 'solid') {
    return <Rect x={0} y={0} width={w} height={h} fill={bgStyle.color ?? '#ffffff'} listening={false} />;
  }
  const angleDeg = bgStyle.angle ?? 135;
  const angleRad = (angleDeg * Math.PI) / 180;
  const dx = Math.cos(angleRad);
  const dy = Math.sin(angleRad);
  const startX = w * Math.max(0, -dx);
  const startY = h * Math.max(0, -dy);
  const endX   = w * Math.max(0,  dx);
  const endY   = h * Math.max(0,  dy);
  return (
    <Rect
      x={0} y={0} width={w} height={h} listening={false}
      fillLinearGradientStartPoint={{ x: startX, y: startY }}
      fillLinearGradientEndPoint={{ x: endX, y: endY }}
      fillLinearGradientColorStops={[0, bgStyle.colorFrom ?? '#0038FF', 1, bgStyle.colorTo ?? '#ffffff']}
    />
  );
}

// Le sélecteur proposait vingt familles Google, toutes de la première page du
// classement de popularité. C'est le catalogue entier qui s'y déverse
// maintenant — Fontshare comprise — sinon la seule façon d'obtenir une typo
// actuelle était d'en téléverser une.
const FONTS = CATALOG_FAMILIES;

// On ne charge PAS quatre-vingt-dix feuilles de style à l'ouverture. Celles du
// document arrivent par `assurerPolicesGoogle`, celle qu'on choisit arrive au
// choix : ce lot-ci ne sert qu'à ce que l'éditeur ait de quoi dessiner tout de
// suite. Les Fontshare tiennent en une seule requête.
const FONTS_AMORCE = [
  'Satoshi', 'Switzer', 'Clash Display', 'Cabinet Grotesk', 'General Sans',
  'Zodiak', 'Boska', 'Gambetta', 'Telma', 'Khand',
  'Instrument Serif', 'Bricolage Grotesque', 'Anton', 'Archivo',
];

const FORMATS = [
  { id: 'ig-portrait', label: 'Portrait 3:4',  sub: '1080×1440', w: 420, h: 560 },
  { id: 'ig-square',   label: 'Carré',          sub: '1080×1080', w: 560, h: 560 },
  { id: 'ig-story',    label: 'Story',           sub: '1080×1920', w: 315, h: 560 },
  { id: 'facebook',    label: 'Facebook Post',   sub: '1200×630',  w: 560, h: 294 },
];

// Filtres photo prédéfinis — mêmes 6 presets que le module Montage vidéo (constants.ts
// FILTERS), réexprimés en réglages adj* (l'éditeur n'a pas de pipeline CSS filter/sepia/
// hue-rotate natif côté Konva, seulement luminosité/contraste/saturation/chaleur/teinte).
const PHOTO_FILTER_PRESETS: { id: string; name: string; values: Partial<Record<'adjBrightness' | 'adjContrast' | 'adjSaturation' | 'adjWarmth' | 'adjTint', number>> }[] = [
  { id: 'none',   name: 'Aucun',      values: {} },
  { id: 'chaud',  name: 'Chaud',      values: { adjWarmth: 30, adjSaturation: 15, adjContrast: 4 } },
  { id: 'doux',   name: 'Doux',       values: { adjBrightness: 5, adjContrast: -4, adjSaturation: -8 } },
  { id: 'froid',  name: 'Froid',      values: { adjWarmth: -25, adjSaturation: 5, adjBrightness: 2 } },
  { id: 'argent', name: 'Argentique', values: { adjWarmth: 20, adjSaturation: -15, adjContrast: 8 } },
  { id: 'nb',     name: 'N&B',        values: { adjSaturation: -100, adjContrast: 10 } },
];

function newId() { return `el-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

// Zones d'interface où l'on peut cliquer sans quitter l'édition d'un texte :
// sinon, sélectionner trois mots puis aller choisir une police fermait
// l'éditeur (et perdait la sélection) avant d'avoir appliqué quoi que ce soit.
const KEEP_TEXT_EDIT_SELECTOR = '[data-stop-deselect], .ed-ctx-float, .ed-mobile-ctx, .ed-panel';

// L'utilisateur est-il en train de SAISIR ? Si oui, les raccourcis de l'éditeur
// (Suppr, flèches, Cmd+A/C/X/D…) doivent lui laisser la main : ils s'adressent
// aux calques, pas au texte en cours de frappe.
// Le champ d'édition du canvas est un contentEditable, pas un <textarea> : ne
// tester que le nom de balise laissait passer Suppr, qui effaçait alors le
// calque entier au lieu du caractère sous le curseur.
function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || typeof el.tagName !== 'string') return false;
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true;
  return el.isContentEditable === true;
}

function measureTextWidth(text: string, fontSize: number, fontFamily: string, fontStyle = 'bold', letterSpacing = 0): number {
  return measureSegment(text, { fontFamily, fontSize, fontStyle, fill: '#000', textDecoration: '', letterSpacing });
}

// ─── Auto-fit (Phase 2) ──────────────────────────────────────────────────────
// Nombre de lignes autorisé par défaut selon le rôle du slot.
function roleMaxLines(role?: string): number {
  switch (role) {
    case 'titre':       return 2;
    case 'sous-titre':  return 2;
    case 'accroche':    return 2;
    case 'cta':         return 1;
    case 'tag':         return 1;
    case 'prix':        return 1;
    case 'corps':       return 6;
    default:            return 3;
  }
}
// Compte de lignes en SIMULANT le retour à la ligne par mots de Konva (wrap="word").
// L'ancienne estimation ceil(largeurTotale/areaW) était un MINORANT : Konva coupe aux
// mots, donc peut produire PLUS de lignes (ex. "NOUVELLE COCCINELLE" -> 2 lignes) et le
// bloc/hitbox se retrouvait trop court -> lignes basses non cliquables.
// La simulation vit désormais dans lib/richText (partagée avec la boîte de
// sélection et l'éditeur en surimpression) : ici on ne garde que les adaptateurs
// pour les appels historiques qui ne manipulent qu'une police uniforme.
// Renvoie le nombre de lignes ET la largeur de la plus longue, pour pouvoir caler
// le fond coloré sur l'encombrement réel du texte plutôt que sur la boîte.
function wrapMetrics(text: string, fontSize: number, font: string, fontStyle: string, areaW: number, letterSpacing = 0): { lines: number; maxLineWidth: number } {
  const layout = layoutText({
    text,
    base: { fontFamily: font, fontSize, fontStyle, fill: '#000', textDecoration: '', letterSpacing, lineHeight: 1.2, align: 'left', uppercase: false },
    areaW,
  });
  return { lines: layout.lineCount, maxLineWidth: layout.maxLineWidth };
}

function countLines(text: string, fontSize: number, font: string, fontStyle: string, areaW: number, letterSpacing = 0): number {
  return wrapMetrics(text, fontSize, font, fontStyle, areaW, letterSpacing).lines;
}

/* Attend que les polices citées soient RÉELLEMENT dessinables avant de mesurer.

   Mesurer un texte dont la police n'est pas encore arrivée, c'est le mesurer
   dans une autre typographie : « LA SUITE ! » tient sur une ligne en Oswald
   (condensé) et déborde sur deux dans la police de repli. Or le re-calage du
   chargement (relayoutText) ne fait pas que dessiner : il ÉCRIT la largeur, la
   taille et le nombre de lignes dans le document. Un visuel validé sur une
   ligne se rouvrait donc replié sur deux, aplat compris, sans qu'on y ait
   touché — le reproche de Martin.

   Les polices Google arrivent par une feuille de style, qu'on ne peut pas
   attendre : `document.fonts.load` force leur téléchargement et rend la main
   quand elles sont posées. Course contre une limite de temps : une police
   injoignable ne doit jamais retenir l'ouverture de l'éditeur. */
/* Les polices de la charte reçoivent leur feuille de style au chargement du
   workspace. Celles du système de design (le grotesque, le serif et le geste
   manuscrit de l'identité typographique choisie pour la marque) n'y sont pas :
   sans ce déclencheur, une composition dessinée sortait en police de repli — le
   geste typographique disparaissait, et avec lui la moitié du dessin. Le
   fournisseur vient du catalogue : la moitié de ces familles sont chez
   Fontshare, pas chez Google. Idempotent : une famille déjà demandée ne
   redemande pas. */
function assurerPolicesGoogle(familles: string[]): void {
  if (typeof document === 'undefined') return;
  for (const { id, href } of fontCssHrefs(familles)) {
    if (document.getElementById(id)) continue;
    const lnk = document.createElement('link');
    lnk.id = id; lnk.rel = 'stylesheet';
    lnk.href = href;
    document.head.appendChild(lnk);
  }
}

async function attendrePolices(familles: string[], limiteMs = 2500): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  const uniques = Array.from(new Set(familles.filter(Boolean)));
  const chargements = uniques.flatMap((f) => [
    document.fonts.load(`400 32px "${f}"`).catch(() => {}),
    document.fonts.load(`700 32px "${f}"`).catch(() => {}),
  ]);
  const pret = Promise.all([...chargements, document.fonts.ready]).then(() => {});
  await Promise.race([pret, new Promise<void>((r) => setTimeout(r, limiteMs))]);
  // Le cache de mesure a pu se remplir AVANT l'attente, avec la police de repli.
  clearTextMetricsCache();
}
// REMPLIR LA MESURE.
//
// L'auto-ajustement ne savait que RÉDUIRE : la taille du dessin était un
// plafond. Un titre court sortait donc à la taille prévue pour un titre long,
// et flottait au milieu de sa colonne — deux blocs empilés se retrouvaient de
// largeurs sans rapport, un chiffre géant occupait la moitié de son aplat. Rien
// ne trahit plus sûrement une composition automatique : un graphiste, lui,
// CALE le titre sur sa mesure.
//
// On laisse donc grandir les titres, sous deux garde-fous, parce que grandir
// pousse aussi ce qu'il y a en dessous :
//  · jamais plus de `maxLines` lignes — le dessin a prévu ce nombre-là ;
//  · la hauteur du bloc ne dépasse pas de plus d'un tiers celle qui lui était
//    réservée (maxLines × taille du dessin), et jamais 1,6 × la taille.
// Réservé aux rôles d'affichage : un paragraphe grossi n'est pas un
// paragraphe rempli, c'est un paragraphe cassé.
const ROLES_QUI_REMPLISSENT = new Set(['titre', 'accroche', 'prix']);

// Calcule la taille de police qui fait tenir le texte dans sa largeur + maxLines.
// Ne change QUE la taille (jamais police ni couleur).
function autoFitFontSize(el: TextEl): number {
  if (!el.text || !el.width || !el.role) return el.fontSize;
  const maxFs = el.maxFontSize ?? el.fontSize;
  const minFs = el.minFontSize ?? Math.max(12, Math.round(el.fontSize * 0.5));
  const maxLines = el.maxLines ?? roleMaxLines(el.role);
  const pH = el.paddingH ?? el.padding ?? 0;
  // LE CARTOUCHE COMPTE DANS LA LARGEUR.
  //
  // On mesurait le texte nu, mais on le DESSINE dans un aplat qui déborde de
  // `highlightPadding` de chaque côté. Un titre calculé « juste à la largeur »
  // sortait donc du cadre une fois son cartouche peint — visible dès que le
  // texte généré est entré dans les templates, où les aplats sont larges.
  const pHl = el.highlightEnabled ? (el.highlightPadding ?? 0) : 0;
  const areaW = Math.max(1, el.width - pH * 2 - pHl * 2);
  const txt = el.uppercase ? el.text.toUpperCase() : el.text;
  const lignes = (fs: number) => countLines(txt, fs, el.fontFamily, el.fontStyle, areaW, el.letterSpacing ?? 0);
  const fits = (fs: number) => lignes(fs) <= maxLines;
  if (fits(maxFs)) {
    // GRANDIR N'EST PERMIS QUE SI LA TAILLE EST UN POINT DE DÉPART.
    //
    // `maxFontSize` est posé par le système de design : il dit « ce dessin vise
    // cette taille, cale-toi sur ta mesure ». Une zone de template, elle, a été
    // dimensionnée À LA MAIN par l'auteur du modèle : la grossir de 60 % défait
    // son travail et fait déborder ses aplats. Sans ce test, mon remplissage
    // optique s'appliquait aux deux.
    if (el.maxFontSize === undefined) return maxFs;
    if (!ROLES_QUI_REMPLISSENT.has(el.role)) return maxFs;
    const budget = maxLines * maxFs * 1.34;
    const plafond = Math.round(maxFs * 1.6);
    const pas = Math.max(1, Math.round(maxFs * 0.05));
    let grand = maxFs;
    for (let fs = maxFs + pas; fs <= plafond; fs += pas) {
      const nl = lignes(fs);
      if (nl <= maxLines && nl * fs <= budget) grand = fs; else break;
    }
    return grand;
  }
  let lo = minFs, hi = maxFs, best = minFs;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (fits(mid)) { best = mid; lo = mid + 1; } else { hi = mid - 1; }
  }
  return best;
}
// Applique l'auto-fit à tous les calques texte (slots) d'une liste d'éléments.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyAutoFit(elements: any[]): any[] {
  if (!Array.isArray(elements)) return elements;
  return elements.map(el => {
    if (el?.type !== 'text' || !el.role) return el;
    const fs = autoFitFontSize(el as TextEl);
    return fs !== el.fontSize ? { ...el, fontSize: fs } : el;
  });
}

/** Ligne de journal identifiant la composition appliquée.
 *  Le nom pour la personne qui regarde, l'identifiant pour celui qui devra
 *  retrouver le dessin dans `designSystem.ts` quand le visuel déplaît. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function nomDeComposition(layout: any): string {
  const id = String(layout?.recipeId ?? '').replace(/^ds:|^tpl:/, '');
  const nom = String(layout?.template?.name ?? '').trim();
  if (!id && !nom) return 'Composition appliquée';
  const origine = layout?.source === 'template' ? 'Modèle maison' : 'Composition';
  return nom && nom !== id ? `${origine} : ${nom} (${id})` : `${origine} : ${id}`;
}

// La photo d'un post arrive comme un CALQUE IMAGE ordinaire, pas comme un « fond ».
//
// Le fond était un objet à part : verrouillé, déplaçable seulement à l'horizontale,
// hors d'atteinte des effets, du recadrage libre, des arrondis. On ne pouvait donc
// rien en faire — alors que c'est l'élément principal du visuel. En calque normal,
// la photo se déplace, se redimensionne, se recadre et accepte tous les réglages,
// comme n'importe quelle image importée ensuite.
function photoLayer(src: string, w: number, h: number): CanvasEl {
  return {
    id: 'photo-1', type: 'image', src,
    x: 0, y: 0, width: w, height: h,
    rotation: 0, opacity: 100,
  } as unknown as CanvasEl;
}

// ─── Typographie de marque ────────────────────────────────────────────────────
// Les polices changeaient d'un client à l'autre, mais le RYTHME typographique
// était identique pour tout le monde : même rapport titre/sous-titre, même
// graisse, même interlettrage, même casse. Deux marques aux antipodes sortaient
// donc avec la même voix graphique — c'est une des raisons pour lesquelles les
// visuels se ressemblaient tous.
//
// On dérive ce rythme du ton et du secteur déclarés dans la charte. Ce n'est pas
// une signature d'auteur, mais c'est la différence entre « la police du client »
// et « la typographie du client ».
type BrandType = { titleScale: number; subScale: number; tracking: number; upper: boolean; titleWeight: 'bold' | 'normal' };

function brandTypography(ws: { tone?: string | null; sector?: string | null } | null): BrandType {
  const t = `${ws?.tone ?? ''} ${ws?.sector ?? ''}`.toLowerCase();
  const has = (...keys: string[]) => keys.some(k => t.includes(k));

  // Chic / premium : titres plus mesurés, lettres aérées, capitales — le registre
  // de la mode et de l'hôtellerie.
  if (has('chic', 'premium', 'luxe', 'élégant', 'elegant', 'raffin')) {
    return { titleScale: 0.92, subScale: 1.0, tracking: 2.2, upper: true, titleWeight: 'bold' };
  }
  // Punchy / direct : titre écrasant, lettres serrées, capitales — l'affiche.
  if (has('punchy', 'direct', 'énergique', 'energique', 'street', 'sport', 'fast')) {
    return { titleScale: 1.18, subScale: 0.92, tracking: -0.6, upper: true, titleWeight: 'bold' };
  }
  // Minimal / sobre : petit titre, pas de capitales, respiration.
  if (has('minimal', 'sobre', 'épuré', 'epure', 'architecte', 'design')) {
    return { titleScale: 0.82, subScale: 1.0, tracking: 0.8, upper: false, titleWeight: 'bold' };
  }
  // Doux / chaleureux : bas de casse, titre modéré — restauration, artisanat, soin.
  if (has('doux', 'chaleureux', 'convivial', 'artisan', 'restaurant', 'café', 'cafe', 'bien-être', 'bien etre')) {
    return { titleScale: 1.0, subScale: 1.05, tracking: 0, upper: false, titleWeight: 'bold' };
  }
  // Défaut : le rythme actuel, inchangé.
  return { titleScale: 1.0, subScale: 1.0, tracking: 0, upper: false, titleWeight: 'bold' };
}

// ─── Règles non négociables ───────────────────────────────────────────────────
// Trois garanties appliquées à TOUTE sortie du moteur — composition IA, template
// repris, bloc de secours. Elles ne remplacent pas le goût : elles empêchent les
// fautes qu'aucun graphiste ne laisserait passer, et qu'on retrouvait pourtant
// dans les visuels rendus.
//
//  1. L'encre d'un texte se déduit de son fond. Deux couleurs de charte posées
//     l'une sur l'autre (bleu sur vert) ne sont pas un parti pris.
//  2. Aucun bloc ne sort du cadre. On mesure le bloc rendu, on le ramène dedans.
//  3. Un aplat ne dépasse jamais du cadre non plus : il est borné avec son texte.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function enforceDesignRules(elements: any[], stageW: number, stageH: number): any[] {
  if (!Array.isArray(elements)) return elements;
  const margin = Math.round(stageW * 0.04);
  return elements.map(el => {
    if (el?.type !== 'text') return el;
    const out = { ...el };

    // 1 — encre lisible sur son propre fond
    const bg = out.highlightEnabled ? out.highlightColor : (out.hasBg ? out.bgColor : null);
    if (bg && typeof bg === 'string') {
      const ink = inkOn(bg);
      // On ne corrige que si le contraste est réellement insuffisant : une
      // couleur de charte qui tient sur son fond reste un choix légitime.
      const lumBg = /^#?([0-9a-f]{6})$/i.test(bg) ? relLum(bg) : 0.5;
      const lumInk = /^#?([0-9a-f]{6})$/i.test(String(out.fill)) ? relLum(String(out.fill)) : 1;
      if (Math.abs(lumBg - lumInk) < 0.4) out.fill = ink;
    }

    // 2 & 3 — le bloc, aplat compris, reste dans le cadre
    const pH = out.paddingH ?? out.padding ?? 0;
    const pV = out.paddingV ?? out.padding ?? 0;
    const hlPad = out.highlightEnabled ? (out.highlightPadding ?? 8) : 0;
    const width = Math.max(1, out.width ?? stageW);
    const m = measureBlockSafe(out, width - pH * 2);
    const blockH = m.lines * (out.fontSize ?? 24) * (out.lineHeight ?? 1.2) + pV * 2 + hlPad * 2;
    const blockW = Math.min(stageW - margin * 2, width + hlPad * 2);
    out.width = Math.max(40, Math.round(blockW - hlPad * 2));
    out.x = Math.min(Math.max(margin, Math.round(out.x ?? 0)), Math.max(margin, stageW - margin - blockW));
    out.y = Math.min(Math.max(margin, Math.round(out.y ?? 0)), Math.max(margin, stageH - margin - blockH));
    return out;
  });
}

// Luminance relative — sert aux règles ci-dessus.
function relLum(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return 1;
  const n = parseInt(m[1], 16);
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
}

// Nombre de lignes réellement rendues, sans jamais lever.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function measureBlockSafe(el: any, areaW: number): { lines: number } {
  try {
    const txt = el.uppercase ? String(el.text ?? '').toUpperCase() : String(el.text ?? '');
    return { lines: Math.max(1, countLines(txt, el.fontSize ?? 24, el.fontFamily ?? 'Archivo', el.fontStyle ?? 'bold', Math.max(1, areaW), el.letterSpacing ?? 0)) };
  } catch { return { lines: 1 }; }
}

// Re-layout complet des slots texte pour un format donné :
// 1) auto-fit taille  2) anti-chevauchement vertical  3) remontée du bloc s'il
// dépasse le bas. Tourne au chargement ET au changement de format.
// Aucune marge horizontale n'est imposée : un texte posé à cheval sur un bord,
// ou collé au ras du cadre, doit rester exactement où on l'a mis. Le rappel à
// l'ordre ne concerne plus que la verticale (chevauchement / sortie par le bas).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function relayoutText(elements: any[], stageW: number, stageH: number): any[] {
  if (!Array.isArray(elements)) return elements;
  const margin = 26, gap = 10;
  // 1 : chaque bloc retrouve la SILHOUETTE que le modèle lui donnait.
  //
  // Un texte écrit par l'IA n'a jamais exactement la longueur de celui du modèle.
  // On ne se contentait alors que de rapetisser la police : un titre prévu sur une
  // ligne passait sur deux, la pile descendait, et la page ne ressemblait plus à
  // ce qui avait été dessiné. Désormais, dans l'ordre :
  //   a) on ÉLARGIT le bloc dans la place libre — c'est presque toujours la bonne
  //      réponse quand il reste du vide à côté ;
  //   b) seulement si ça ne suffit pas, on réduit la police.
  // L'élargissement respecte le point d'ancrage : un bloc aligné à droite grandit
  // vers la gauche, un bloc centré grandit des deux côtés. Sans ça, « élargir »
  // voudrait dire « déplacer », et le visuel se décalerait.
  const els = elements.map(el => {
    if (el?.type !== 'text' || !el.role) return el;
    const width0 = el.width ?? Math.max(60, stageW - (el.x ?? 0));
    const x0 = el.x ?? 0;
    const pH = el.paddingH ?? el.padding ?? 0;
    const align = ['left', 'center', 'right'].includes(el.align) ? el.align : 'left';
    const txt = el.uppercase ? String(el.text ?? '').toUpperCase() : String(el.text ?? '');
    // Même raison que dans `autoFitFontSize` : l'aplat déborde du texte.
    const pHl = el.highlightEnabled ? (el.highlightPadding ?? 0) : 0;
    const linesAt = (w: number, fs: number) =>
      countLines(txt, fs, el.fontFamily, el.fontStyle, Math.max(1, w - pH * 2 - pHl * 2), el.letterSpacing ?? 0);

    // Combien de lignes le modèle prévoyait-il ? Le texte d'origine du modèle est
    // la référence la plus juste — mesuré ici, avec les polices vraiment chargées.
    const target = el.origText
      ? Math.max(1, countLines(
          el.uppercase ? String(el.origText).toUpperCase() : String(el.origText),
          el.maxFontSize ?? el.fontSize, el.fontFamily, el.fontStyle,
          Math.max(1, width0 - pH * 2), el.letterSpacing ?? 0))
      : (el.maxLines ?? roleMaxLines(el.role));

    let width = width0;
    let x = x0;
    if (linesAt(width0, el.fontSize) > target && !el.lockWidth) {
      // Place disponible de chaque côté, ancre par ancre.
      const maxWidth = align === 'left'
        ? Math.max(width0, stageW - margin - x0)
        : align === 'right'
          ? Math.max(width0, (x0 + width0) - margin)
          : Math.max(width0, 2 * Math.min((x0 + width0 / 2) - margin, stageW - margin - (x0 + width0 / 2)));
      if (maxWidth > width0 && linesAt(maxWidth, el.fontSize) <= target) {
        // Plus petite largeur qui suffit : on n'empiète pas plus que nécessaire.
        let lo = width0, hi = Math.round(maxWidth), best = Math.round(maxWidth);
        while (lo <= hi) {
          const mid = Math.floor((lo + hi) / 2);
          if (linesAt(mid, el.fontSize) <= target) { best = mid; hi = mid - 1; } else { lo = mid + 1; }
        }
        width = best;
        x = align === 'right' ? (x0 + width0) - width
          : align === 'center' ? Math.round((x0 + width0 / 2) - width / 2)
          : x0;
      }
    }
    const withW = { ...el, width, x, maxLines: el.maxLines ?? target };
    return { ...withW, fontSize: autoFitFontSize(withW as TextEl) };
  });
  // 2 : anti-chevauchement (slots, par ordre vertical)
  const order = els
    .map((e, i) => ({ e, i }))
    .filter(o => o.e?.type === 'text' && o.e.role)
    .sort((a, b) => (a.e.y ?? 0) - (b.e.y ?? 0));
  const heightOf = (e: TextEl) => {
    const pH = e.paddingH ?? e.padding ?? 0;
    const pV = e.paddingV ?? e.padding ?? 0;
    const areaW = Math.max(1, (e.width ?? stageW) - pH * 2);
    const txt = e.uppercase ? (e.text || '').toUpperCase() : (e.text || '');
    const lines = countLines(txt, e.fontSize, e.fontFamily, e.fontStyle, areaW, e.letterSpacing ?? 0);
    return lines * e.fontSize * (e.lineHeight ?? 1.2) + pV * 2;
  };
  let prevBottom = -Infinity;
  for (const { e, i } of order) {
    const h = heightOf(e as TextEl);
    let y = e.y ?? 0;
    if (y < prevBottom + gap) { y = Math.round(prevBottom + gap); els[i] = { ...els[i], y }; }
    prevBottom = y + h;
  }
  // 3 : si la pile dépasse le bas, on la remonte (sans sortir par le haut)
  const bottomLimit = stageH - margin;
  if (prevBottom > bottomLimit && order.length) {
    const topY = els[order[0].i].y ?? 0;
    const shift = Math.min(prevBottom - bottomLimit, Math.max(0, topY - margin));
    if (shift > 0) for (const { i } of order) els[i] = { ...els[i], y: Math.round((els[i].y ?? 0) - shift) };
  }
  return els;
}

const PT_FORMAT_MAP: Record<string, string> = { post: 'ig-portrait', reel: 'ig-story', story: 'ig-story', carrousel: 'ig-square' };

// Magic Resize — reprojette les éléments d'un format vers un autre. Position (x/y)
// mise à l'échelle indépendamment par axe pour rester proportionnelle au nouveau
// canevas ; tailles/rayons/police mis à l'échelle uniforme (facteur min des deux
// axes) pour éviter les distorsions (cercle qui s'ovalise, texte étiré) — les
// largeurs de texte suivent l'axe X pour occuper une proportion similaire du
// nouveau canevas, relayoutText() corrige ensuite tout débordement.
function remapElementsToFormat(elements: CanvasEl[], oldW: number, oldH: number, newW: number, newH: number): CanvasEl[] {
  const sx = newW / oldW, sy = newH / oldH;
  const s = Math.min(sx, sy);
  return elements.map(el => {
    const x = el.x * sx, y = el.y * sy;
    if (el.type === 'text') {
      // Les morceaux stylés portent une taille absolue : ils suivent la même
      // échelle que le bloc, sinon un mot agrandi resterait à sa taille d'origine.
      return {
        ...el, x, y, width: el.width * sx,
        fontSize: Math.max(8, Math.round(el.fontSize * s)),
        runs: el.runs?.map(r => r.fontSize === undefined ? r : { ...r, fontSize: Math.max(8, Math.round(r.fontSize * s)) }),
      };
    }
    if (el.type === 'rect' || el.type === 'vector' || el.type === 'image') {
      return { ...el, x, y, width: el.width * sx, height: el.height * sy };
    }
    if (el.type === 'circle') {
      return { ...el, x, y, radius: el.radius * s };
    }
    if (el.type === 'star') {
      return { ...el, x, y, innerRadius: el.innerRadius * s, outerRadius: el.outerRadius * s };
    }
    return el;
  });
}

// Formats cibles pour Magic Resize — uniquement les 3 couples post_type/format_id
// avec un mapping retour propre via PT_FORMAT_MAP (le format 'facebook' n'a pas de
// post_type associé : un post créé dans ce format se rechargerait à tort en
// 'ig-portrait', donc on l'exclut volontairement des cibles auto-resize).
// Le carré n'est plus une cible : il servait au type « carrousel », qui n'existe
// plus en tant que type (un carrousel se publie au format du post).
const MAGIC_RESIZE_TARGETS: { postType: 'post' | 'carrousel' | 'reel'; formatId: string }[] = [
  { postType: 'post', formatId: 'ig-portrait' },
  { postType: 'reel', formatId: 'ig-story' },
];

// Couleur de texte lisible SUR un aplat donné. Deux couleurs de charte
// appariées au hasard (bleu sur vert) ne sont pas un choix graphique : c'est un
// défaut de lisibilité. La couleur du texte se déduit toujours de son fond.
function inkOn(bg: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(bg || '');
  if (!m) return '#FFFFFF';
  const n = parseInt(m[1], 16);
  const lum = (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  return lum > 0.55 ? '#14160F' : '#FFFFFF';
}

// Tracé d'un rectangle à coins arrondis — sert de masque de découpe pour les
// images arrondies (Konva ne sait arrondir nativement qu'un Rect).
function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

// Bug 3 fix: object-fit cover behavior + drag-to-reposition
function BgImage({ src, w, h, offsetX = 0, offsetY = 0, draggable = false, onDragEnd, opacity = 1, onSelect }:
  { src: string; w: number; h: number; offsetX?: number; offsetY?: number; draggable?: boolean; onDragEnd?: (x: number, y: number) => void; opacity?: number; onSelect?: () => void }
) {
  const [img] = useImage(src, 'anonymous');
  if (!img) return null;

  const natW = img.naturalWidth || img.width;
  const natH = img.naturalHeight || img.height;

  // Fallback to stretch if natural dimensions unknown (prevents broken display)
  if (!natW || !natH) {
    return <KonvaImage image={img} x={0} y={0} width={w} height={h} listening={false} />;
  }

  // object-fit: cover — scale so image fills entire stage
  const scale = Math.max(w / natW, h / natH);
  const scaledW = natW * scale;
  const scaledH = natH * scale;

  // Clamp offset so image always covers the stage (no black bars)
  const clampedX = Math.min(0, Math.max(w - scaledW, offsetX));
  const clampedY = Math.min(0, Math.max(h - scaledH, offsetY));

  return (
    <KonvaImage
      image={img}
      x={clampedX} y={clampedY}
      width={scaledW} height={scaledH}
      listening={draggable || !!onSelect}
      draggable={draggable}
      opacity={opacity}
      onClick={onSelect}
      onTap={onSelect}
      onDragMove={draggable ? (e => {
        const nx = Math.min(0, Math.max(w - scaledW, e.target.x()));
        const ny = Math.min(0, Math.max(h - scaledH, e.target.y()));
        e.target.x(nx); e.target.y(ny);
      }) : undefined}
      onDragEnd={draggable ? (e => {
        onDragEnd?.(e.target.x(), e.target.y());
      }) : undefined}
    />
  );
}

// Filtre colorimétrique personnalisé (un seul passage : luminosité, contraste, chaleur, teinte, saturation)
// Lit les réglages depuis les attributs du nœud Konva (adjBrightness, adjContrast, …).
function AdjustFilter(this: Konva.Node, imageData: ImageData) {
  const d = imageData.data;
  const bright = (Number(this.getAttr('adjBrightness')) || 0) / 100;   // -1..1
  const contrastV = Number(this.getAttr('adjContrast')) || 0;          // -100..100
  const sat = 1 + (Number(this.getAttr('adjSaturation')) || 0) / 100;  // 0..2
  const warmth = (Number(this.getAttr('adjWarmth')) || 0) / 100;       // -1..1
  const tint = (Number(this.getAttr('adjTint')) || 0) / 100;           // -1..1
  const cf = (259 * (contrastV + 255)) / (255 * (259 - contrastV));    // facteur de contraste
  const brightAdd = bright * 255;
  const warmR = warmth * 42, warmB = -warmth * 42, tintG = tint * 42;
  const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i], g = d[i + 1], b = d[i + 2];
    r += brightAdd; g += brightAdd; b += brightAdd;
    r = cf * (r - 128) + 128; g = cf * (g - 128) + 128; b = cf * (b - 128) + 128;
    r += warmR; b += warmB; g += tintG;
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    r = gray + sat * (r - gray); g = gray + sat * (g - gray); b = gray + sat * (b - gray);
    d[i] = clamp(r); d[i + 1] = clamp(g); d[i + 2] = clamp(b);
  }
}
const ADJ_FILTERS = [AdjustFilter, Konva.Filters.Blur];

function imageHasAdjustments(el: ImageEl): boolean {
  return !!(el.adjBrightness || el.adjContrast || el.adjSaturation || el.adjWarmth || el.adjTint || el.adjBlur);
}

function ImgNode({ el, onSelect, onChange, onDragStart, onDragMove, onDragEnd, isCropping, locked }: {
  el: ImageEl; onSelect: (shiftKey: boolean) => void; onChange: (u: Partial<ImageEl>) => void;
  onDragStart?: () => void; onDragMove?: (e: Konva.KonvaEventObject<DragEvent>) => void; onDragEnd?: (x: number, y: number) => void; isCropping?: boolean; locked?: boolean;
}) {
  const [img] = useImage(el.src, 'anonymous');
  const imgRef = useRef<Konva.Image>(null);
  const hasAdj = imageHasAdjustments(el);

  // Store natural dimensions once the image is loaded, et fige le zoom initial
  // (imgScale) une bonne fois pour toutes — c'est cette valeur, pas le cadre en
  // cours de redimensionnement, qui pilote l'échelle de l'image (cf. plus bas).
  useEffect(() => {
    if (img && img.naturalWidth > 0 && !el.naturalW) {
      const initScale = Math.max(el.width / img.naturalWidth, el.height / img.naturalHeight);
      onChange({ naturalW: img.naturalWidth, naturalH: img.naturalHeight, imgScale: el.imgScale ?? initScale });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [img]);

  // (Re)met en cache le nœud pour appliquer/rafraîchir les filtres colorimétriques
  useEffect(() => {
    const node = imgRef.current;
    if (!node) return;
    if (hasAdj && img) {
      try { node.cache(); node.getLayer()?.batchDraw(); }
      catch { /* image cross-origin non autorisée : on ignore le filtre */ }
    } else {
      node.clearCache();
      node.getLayer()?.batchDraw();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [img, hasAdj, el.adjBrightness, el.adjContrast, el.adjSaturation, el.adjWarmth, el.adjTint, el.adjBlur, el.width, el.height]);

  const natW = el.naturalW ?? (img?.naturalWidth || el.width);
  const natH = el.naturalH ?? (img?.naturalHeight || el.height);
  const frameW = el.width;
  const frameH = el.height;
  // C'est imgScale (figé au chargement) qui décide, PAS la taille courante du
  // cadre : sinon toucher une seule poignée (ex. haut/bas) fait « zoomer »
  // l'image entière au lieu de simplement révéler/masquer plus de cadre —
  // exactement le bug remonté : les poignées horizontales semblaient bien
  // « croper » (l'axe dominant n'a jamais de marge à révéler, donc rien n'y
  // trahissait le souci) tandis que les verticales changeaient visiblement la
  // taille de l'image.
  //
  // La couverture du cadre est tenue en amont, au geste : quand un bord est
  // tiré au-delà de ce que la photo couvre, SelectionOverlay remonte le zoom
  // juste ce qu'il faut et recadre l'autre axe. Ici on se contente donc de
  // dessiner ce qui a été décidé.
  const scale = el.imgScale ?? Math.max(frameW / natW, frameH / natH);
  const scaledW = natW * scale;
  const scaledH = natH * scale;
  const cropX = el.cropX ?? (frameW - scaledW) / 2;
  const cropY = el.cropY ?? (frameH - scaledH) / 2;
  // Borné à la moitié du plus petit côté : au-delà, le tracé se replierait sur lui-même.
  const radius = Math.max(0, Math.min(el.cornerRadius ?? 0, frameW / 2, frameH / 2));

  return (
    <Group
      id={el.id}
      x={el.x} y={el.y}
      rotation={el.rotation}
      opacity={el.opacity / 100}
      {...(radius > 0
        // Coins arrondis : le découpage rectangulaire ne suffit plus, on découpe
        // sur un tracé arrondi — l'image elle-même est donc rognée, pas seulement
        // habillée d'un cadre.
        ? { clipFunc: (ctx: Konva.Context) => roundRectPath(ctx as unknown as CanvasRenderingContext2D, 0, 0, frameW, frameH, radius) }
        : { clipX: 0, clipY: 0, clipWidth: frameW, clipHeight: frameH })}
      draggable={!isCropping && !locked}
      onClick={e => onSelect(e.evt.shiftKey)} onTap={() => onSelect(false)}
      onDragStart={!isCropping ? onDragStart : undefined}
      onDragMove={!isCropping ? onDragMove : undefined}
      onDragEnd={!isCropping ? (e => onDragEnd?.(e.target.x(), e.target.y())) : undefined}
    >
      <KonvaImage
        ref={imgRef}
        image={img}
        x={cropX} y={cropY}
        width={scaledW} height={scaledH}
        filters={hasAdj ? ADJ_FILTERS : undefined}
        adjBrightness={el.adjBrightness || 0}
        adjContrast={el.adjContrast || 0}
        adjSaturation={el.adjSaturation || 0}
        adjWarmth={el.adjWarmth || 0}
        adjTint={el.adjTint || 0}
        blurRadius={el.adjBlur || 0}
        draggable={isCropping}
        onDragMove={isCropping ? (e => {
          // Bornes symétriques : avec un zoom figé (imgScale), l'image peut
          // désormais être plus PETITE que son cadre (cadre agrandi au-delà de
          // ce qu'elle couvre) — le clamp supposait jusqu'ici l'inverse
          // (frameW-scaledW toujours ≤ 0), ce qui bloquait tout déplacement
          // dans ce cas.
          const loX = Math.min(0, frameW - scaledW), hiX = Math.max(0, frameW - scaledW);
          const loY = Math.min(0, frameH - scaledH), hiY = Math.max(0, frameH - scaledH);
          const nx = Math.min(hiX, Math.max(loX, e.target.x()));
          const ny = Math.min(hiY, Math.max(loY, e.target.y()));
          e.target.x(nx); e.target.y(ny);
        }) : undefined}
        onDragEnd={isCropping ? (e => {
          onChange({ cropX: e.target.x(), cropY: e.target.y() });
        }) : undefined}
        onMouseEnter={isCropping ? (e => { const s = e.target.getStage(); if (s) s.container().style.cursor = 'grab'; }) : undefined}
        onMouseLeave={isCropping ? (e => { const s = e.target.getStage(); if (s) s.container().style.cursor = 'default'; }) : undefined}
      />
    </Group>
  );
}

// ─── Vector draw helpers ──────────────────────────────────────────────────────

function buildSvgPath(points: AnchorPoint[], closed: boolean): string {
  if (points.length === 0) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cp1 = prev.cpOut ?? { x: prev.x, y: prev.y };
    const cp2 = curr.cpIn ?? { x: curr.x, y: curr.y };
    d += ` C ${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${curr.x} ${curr.y}`;
  }
  if (closed && points.length > 2) {
    const last = points[points.length - 1];
    const first = points[0];
    const cp1 = last.cpOut ?? { x: last.x, y: last.y };
    const cp2 = first.cpIn ?? { x: first.x, y: first.y };
    d += ` C ${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${first.x} ${first.y} Z`;
  }
  return d;
}

function drawCustomPath(ctx: CanvasRenderingContext2D, points: AnchorPoint[], closed: boolean) {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cp1 = prev.cpOut ?? { x: prev.x, y: prev.y };
    const cp2 = curr.cpIn ?? { x: curr.x, y: curr.y };
    ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, curr.x, curr.y);
  }
  if (closed) {
    const last = points[points.length - 1];
    const first = points[0];
    const cp1 = last.cpOut ?? { x: last.x, y: last.y };
    const cp2 = first.cpIn ?? { x: first.x, y: first.y };
    ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, first.x, first.y);
    ctx.closePath();
  }
}

// Arrondi effectif d'une forme : borné pour que le tracé ne se replie jamais.
function vectorRadius(el: VectorEl, w: number, h: number): number {
  if (el.shape !== 'rectangle') return 0;
  return Math.max(0, Math.min(el.cornerRadius ?? 0, w / 2, h / 2));
}

function drawVectorShape(ctx: CanvasRenderingContext2D, shape: Exclude<VectorEl['shape'], 'custom'>, w: number, h: number, radius = 0) {
  ctx.beginPath();
  switch (shape) {
    case 'rectangle':
      // Un rectangle s'arrondit — c'est le geste de base d'un logiciel de création.
      if (radius > 0) roundRectPath(ctx, 0, 0, w, h, radius);
      else ctx.rect(0, 0, w, h);
      break;
    case 'circle': {
      const rx = w / 2, ry = h / 2;
      ctx.ellipse(rx, ry, rx, ry, 0, 0, Math.PI * 2);
      break;
    }
    case 'triangle':
      ctx.moveTo(w / 2, 0); ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
      break;
    case 'star': {
      const cx = w / 2, cy = h / 2;
      const r1 = Math.min(w, h) / 2, r2 = r1 * 0.42;
      for (let i = 0; i < 10; i++) {
        const a = (i * Math.PI) / 5 - Math.PI / 2;
        const r = i % 2 === 0 ? r1 : r2;
        i === 0 ? ctx.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a)) : ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
      }
      ctx.closePath();
      break;
    }
    case 'pill': {
      const r = h / 2;
      ctx.moveTo(r, 0); ctx.lineTo(w - r, 0);
      ctx.arc(w - r, h / 2, r, -Math.PI / 2, Math.PI / 2);
      ctx.lineTo(r, h);
      ctx.arc(r, h / 2, r, Math.PI / 2, -Math.PI / 2);
      ctx.closePath();
      break;
    }
    case 'arrow': {
      const aw = w * 0.38, ah = h * 0.30;
      ctx.moveTo(0, h / 2 - ah / 2); ctx.lineTo(w - aw, h / 2 - ah / 2);
      ctx.lineTo(w - aw, 0); ctx.lineTo(w, h / 2);
      ctx.lineTo(w - aw, h); ctx.lineTo(w - aw, h / 2 + ah / 2);
      ctx.lineTo(0, h / 2 + ah / 2); ctx.closePath();
      break;
    }
    case 'diamond':
      ctx.moveTo(w / 2, 0); ctx.lineTo(w, h / 2); ctx.lineTo(w / 2, h); ctx.lineTo(0, h / 2); ctx.closePath();
      break;
    case 'hexagon': {
      const cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2;
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3 - Math.PI / 6;
        i === 0 ? ctx.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a)) : ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
      }
      ctx.closePath();
      break;
    }
  }
}

function VectorNode({ el, onSelect, onDblClick, onDragStart, onDragMove, onDragEnd, isMaskCrop, onImageOffset, locked }: {
  el: VectorEl; onSelect: (shiftKey: boolean) => void;
  onDblClick?: () => void;
  onDragStart?: () => void; onDragMove?: (e: Konva.KonvaEventObject<DragEvent>) => void; onDragEnd?: (x: number, y: number) => void;
  isMaskCrop?: boolean; onImageOffset?: (x: number, y: number) => void; locked?: boolean;
}) {
  const [maskImg] = useImage(el.fillType === 'image' && el.imageSrc ? el.imageSrc : '', 'anonymous');

  if (el.fillType === 'image' && el.imageSrc) {
    const natW = maskImg ? (maskImg.naturalWidth || maskImg.width || el.width) : el.width;
    const natH = maskImg ? (maskImg.naturalHeight || maskImg.height || el.height) : el.height;
    const scale = Math.max(el.width / natW, el.height / natH);
    const scaledW = natW * scale;
    const scaledH = natH * scale;
    const offX = el.imageOffsetX ?? (el.width - scaledW) / 2;
    const offY = el.imageOffsetY ?? (el.height - scaledH) / 2;
    const clipFn = (ctx: any) => {
      const c = ctx as CanvasRenderingContext2D;
      if (el.shape === 'custom') drawCustomPath(c, el.points ?? [], el.closed ?? false);
      else drawVectorShape(c, el.shape as Exclude<VectorEl['shape'], 'custom'>, el.width, el.height, vectorRadius(el, el.width, el.height));
    };
    return (
      <Group
        x={el.x} y={el.y} rotation={el.rotation} opacity={el.opacity / 100}
        clipFunc={clipFn}
        draggable={!isMaskCrop && !locked}
        onClick={e => onSelect(e.evt.shiftKey)} onTap={() => onSelect(false)}
        onDblClick={() => onDblClick?.()}
        onDragStart={!isMaskCrop ? onDragStart : undefined}
        onDragMove={!isMaskCrop ? onDragMove : undefined}
        onDragEnd={!isMaskCrop ? (e => onDragEnd?.(e.target.x(), e.target.y())) : undefined}
      >
        <KonvaImage
          image={maskImg} x={offX} y={offY} width={scaledW} height={scaledH}
          draggable={!!isMaskCrop}
          onDragMove={isMaskCrop ? (e => {
            const nx = Math.min(0, Math.max(el.width - scaledW, e.target.x()));
            const ny = Math.min(0, Math.max(el.height - scaledH, e.target.y()));
            e.target.x(nx); e.target.y(ny);
          }) : undefined}
          onDragEnd={isMaskCrop ? (e => onImageOffset?.(e.target.x(), e.target.y())) : undefined}
          onMouseEnter={isMaskCrop ? (e => { const s = e.target.getStage(); if (s) s.container().style.cursor = 'grab'; }) : undefined}
          onMouseLeave={isMaskCrop ? (e => { const s = e.target.getStage(); if (s) s.container().style.cursor = 'default'; }) : undefined}
        />
        {el.strokeWidth > 0 && (
          <KonvaShape
            width={el.width} height={el.height}
            stroke={el.stroke} strokeWidth={el.strokeWidth * 2}
            fill="rgba(0,0,0,0)"
            listening={false}
            sceneFunc={(kctx, shape) => {
              const ctx = (kctx as any)._context as CanvasRenderingContext2D;
              if (el.shape === 'custom') drawCustomPath(ctx, el.points ?? [], el.closed ?? false);
              else drawVectorShape(ctx, el.shape as Exclude<VectorEl['shape'], 'custom'>, shape.width(), shape.height(), vectorRadius(el, shape.width(), shape.height()));
              kctx.fillStrokeShape(shape);
            }}
          />
        )}
      </Group>
    );
  }

  const draw = (kctx: any, shape: any) => {
    const ctx = (kctx as any)._context as CanvasRenderingContext2D;
    if (el.shape === 'custom') {
      drawCustomPath(ctx, el.points ?? [], el.closed ?? false);
    } else {
      drawVectorShape(ctx, el.shape as Exclude<VectorEl['shape'], 'custom'>, shape.width(), shape.height(), vectorRadius(el, shape.width(), shape.height()));
    }
    kctx.fillStrokeShape(shape);
  };
  return (
    <KonvaShape
      x={el.x} y={el.y}
      width={el.width} height={el.height}
      rotation={el.rotation}
      opacity={el.opacity / 100}
      {...(el.fillType === 'none'
        ? { fill: 'rgba(0,0,0,0)' }
        : el.fillType === 'gradient'
        ? gradientFillProps(el.width, el.height, el.fillAngle ?? 90, el.fill, el.fillTo ?? '#ffffff')
        : { fill: el.fill })}
      stroke={el.stroke}
      strokeWidth={el.strokeWidth}
      draggable={!locked}
      sceneFunc={draw}
      hitFunc={draw}
      onClick={e => onSelect(e.evt.shiftKey)}
      onTap={() => onSelect(false)}
      onDblClick={() => onDblClick?.()}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={e => onDragEnd?.(e.target.x(), e.target.y())}
    />
  );
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const btnStyle: React.CSSProperties = {
  padding: '7px 14px', background: 'var(--sunk)', border: '1px solid var(--line)',
  borderRadius: 6, cursor: 'pointer', fontSize: 13, color: 'var(--ink-2)', fontFamily: 'var(--sans)',
};
const smallBtnStyle: React.CSSProperties = {
  padding: '4px 8px', background: 'var(--sunk)', border: '1px solid var(--line)',
  borderRadius: 4, cursor: 'pointer', fontSize: 12, color: 'var(--ink-3)',
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px 0', fontFamily: 'var(--mono)', fontWeight: 800 }}>
      {children}
    </p>
  );
}

function PropRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6, fontFamily: 'var(--mono)', fontWeight: 800 }}>{label}</label>
      {children}
    </div>
  );
}

function ColorRow({ label, value, onChange, brandColors }: { label: string; value: string; onChange: (v: string) => void; brandColors?: string[] }) {
  return (
    <PropRow label={label}>
      <ColorPicker value={value} onChange={onChange} brandColors={brandColors} />
    </PropRow>
  );
}

function UnsplashThumb({ src, dragSrc, onAdd, onBg }: { src: string; dragSrc?: string; onAdd: () => void; onBg: () => void }) {
  const T = useTranslations('editor');
  const [hovered, setHovered] = useState(false);
  return (
    <div style={{ position: 'relative', aspectRatio: '1', borderRadius: 4, overflow: 'hidden', cursor: 'pointer' }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" draggable
        // On glisse la pleine résolution, pas la vignette affichée.
        onDragStart={e => e.dataTransfer.setData('application/x-klip-image', dragSrc ?? src)}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      {hovered && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', justifyContent: 'center' }}>
          <button onClick={onAdd} style={{ padding: '4px 8px', background: 'var(--cream)', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>{T('addCanvas')}</button>
          <button onClick={onBg} style={{ padding: '4px 8px', background: 'var(--leaf)', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 10, fontWeight: 700, color: 'var(--mint-ink)' }}>{T('background')}</button>
        </div>
      )}
    </div>
  );
}

function TextProperties({ el, onChange, customFonts, onFontUpload, brandColors, brandFontNames }: { el: TextEl; onChange: (u: Partial<TextEl>) => void; customFonts: { name: string; url: string }[]; onFontUpload: (file: File) => Promise<string>; brandColors?: string[]; brandFontNames?: string[] }) {
  const T = useTranslations('editor');
  const isBold = el.fontStyle.includes('bold');
  const isItalic = el.fontStyle.includes('italic');
  const isUnderline = el.textDecoration === 'underline';
  const toggleBold = () => onChange({ fontStyle: isItalic ? (isBold ? 'italic' : 'bold italic') : (isBold ? 'normal' : 'bold') });
  const toggleItalic = () => onChange({ fontStyle: isBold ? (isItalic ? 'bold' : 'bold italic') : (isItalic ? 'normal' : 'italic') });
  return (
    <>
      <PropRow label={T('content')}>
        <textarea value={el.text} onChange={e => onChange({ text: e.target.value })} rows={3}
          style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 'var(--r-s)', fontSize: 13, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'var(--sans)', outline: 'none', background: 'var(--white)', color: 'var(--ink)' }} />
      </PropRow>
      <PropRow label={T('font')}>
        {/* La feuille de style part au CHOIX de la police : avec quatre-vingt-dix
            familles au catalogue, on ne les charge plus toutes à l'ouverture,
            et sans ce déclencheur le texte resterait en police de repli. */}
        <select value={el.fontFamily} onChange={e => { assurerPolicesGoogle([e.target.value]); onChange({ fontFamily: e.target.value }); }}
          style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--line)', borderRadius: 'var(--r-s)', fontSize: 13, outline: 'none', background: 'var(--white)', color: 'var(--ink)', fontFamily: `"${el.fontFamily}", sans-serif` }}>
          {brandFontNames && brandFontNames.length > 0 && (
            <optgroup label={T('brandKit')}>
              {brandFontNames.map(f => <option key={f} value={f}>{f}</option>)}
            </optgroup>
          )}
          {customFonts.filter(f => !brandFontNames?.includes(f.name)).length > 0 && (
            <optgroup label={T('myFonts')}>
              {customFonts.filter(f => !brandFontNames?.includes(f.name)).map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
            </optgroup>
          )}
          <optgroup label={T('googleFonts')}>
            {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
          </optgroup>
        </select>
        <div style={{ marginTop: 12 }}>
          <label style={{ fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--mono)', fontWeight: 800 }}>
            {T('uploadFont')}
          </label>
          <label style={{ display: 'block', marginTop: 8, background: 'var(--sunk)', border: '1.5px solid var(--line)', color: 'var(--ink-2)', padding: '10px', borderRadius: 8, cursor: 'pointer', textAlign: 'center', fontSize: 13 }}>
            {T('uploadFontBtn')}
            <input type="file" accept=".ttf,.otf,.woff,.woff2" style={{ display: 'none' }}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const fontName = await onFontUpload(file);
                onChange({ fontFamily: fontName });
              }}
            />
          </label>
        </div>
      </PropRow>
      <PropRow label={T('sizeVal', { n: el.fontSize })}>
        <input type="range" min={8} max={120} value={el.fontSize} onChange={e => onChange({ fontSize: Number(e.target.value) })} style={{ width: '100%', accentColor: 'var(--mint-2)' }} />
      </PropRow>
      <PropRow label={T('styleLabel')}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[{ label: 'G', title: T('bold'), active: isBold, fn: toggleBold }, { label: 'I', title: T('italic'), active: isItalic, fn: toggleItalic }, { label: 'S', title: T('underline'), active: isUnderline, fn: () => onChange({ textDecoration: isUnderline ? '' : 'underline' }) }].map(({ label, title, active, fn }) => (
            <button key={label} onClick={fn} title={title}
              style={{ flex: 1, padding: '7px 6px', border: 'none', borderRadius: 'var(--r-s)', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: active ? 'var(--leaf)' : 'var(--btn-soft)', color: active ? 'var(--mint-ink)' : 'var(--ink-2)' }}>
              {label}
            </button>
          ))}
        </div>
      </PropRow>
      <PropRow label={T('alignment')}>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['left', 'center', 'right'] as const).map(a => (
            <button key={a} onClick={() => onChange({ align: a })}
              style={{ flex: 1, padding: '7px 6px', border: 'none', borderRadius: 'var(--r-s)', cursor: 'pointer', fontSize: 13, background: el.align === a ? 'var(--leaf)' : 'var(--btn-soft)', color: el.align === a ? 'var(--mint-ink)' : 'var(--ink-2)' }}>
              {a === 'left'
                ? <svg width="13" height="11" viewBox="0 0 13 11" fill="currentColor"><rect x="0" y="0" width="13" height="2" rx="1"/><rect x="0" y="4.5" width="8" height="2" rx="1"/><rect x="0" y="9" width="10" height="2" rx="1"/></svg>
                : a === 'center'
                ? <svg width="13" height="11" viewBox="0 0 13 11" fill="currentColor"><rect x="0" y="0" width="13" height="2" rx="1"/><rect x="2.5" y="4.5" width="8" height="2" rx="1"/><rect x="1.5" y="9" width="10" height="2" rx="1"/></svg>
                : <svg width="13" height="11" viewBox="0 0 13 11" fill="currentColor"><rect x="0" y="0" width="13" height="2" rx="1"/><rect x="5" y="4.5" width="8" height="2" rx="1"/><rect x="3" y="9" width="10" height="2" rx="1"/></svg>}
            </button>
          ))}
        </div>
      </PropRow>
      <ColorRow label={T('textColor')} value={el.fill} onChange={v => onChange({ fill: v })} brandColors={brandColors} />
      {/* Le fond de texte vit uniquement dans l'effet « Arrière-plan » du
          panneau Effet — un seul réglage, celui qui épouse chaque ligne. */}
      <PropRow label={T('opacityVal', { n: el.opacity })}>
        <input type="range" min={0} max={100} value={el.opacity} onChange={e => onChange({ opacity: Number(e.target.value) })} style={{ width: '100%', accentColor: 'var(--mint-2)' }} />
      </PropRow>
      {/* 4D — IA role for structured generation */}
      <PropRow label={T('aiRole')}>
        <select value={el.role || ''} onChange={e => onChange({ role: e.target.value || undefined })}
          style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--line)', borderRadius: 'var(--r-s)', fontSize: 13, outline: 'none', background: 'var(--white)', color: 'var(--ink)' }}>
          <option value="">{T('none')}</option>
          <option value="accroche">{T('roleHook')}</option>
          <option value="titre">{T('roleTitle')}</option>
          <option value="sous-titre">{T('roleSubtitle')}</option>
          <option value="corps">{T('roleBody')}</option>
          <option value="cta">{T('roleCta')}</option>
          <option value="prix">{T('rolePrice')}</option>
          <option value="personnalise">Champ personnalisé…</option>
        </select>
        {/* Champ nommé par l'auteur : ce bloc contiendra TOUJOURS cette
            information, et l'IA reçoit le nom tel quel. */}
        {el.role === 'personnalise' && (
          <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <input value={el.roleLabel ?? ''} onChange={e => onChange({ roleLabel: e.target.value || undefined })}
              placeholder="Nom du champ — ex. Nom du journal"
              style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--line)', borderRadius: 'var(--r-s)', fontSize: 13, outline: 'none', background: 'var(--white)', color: 'var(--ink)', boxSizing: 'border-box' }} />
            <input value={el.roleHint ?? ''} onChange={e => onChange({ roleHint: e.target.value || undefined })}
              placeholder="Ce qu'on y met (facultatif)"
              style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--line)', borderRadius: 'var(--r-s)', fontSize: 12.5, outline: 'none', background: 'var(--white)', color: 'var(--ink)', boxSizing: 'border-box' }} />
          </div>
        )}
        {el.role && (
          <span style={{ fontSize: 10, color: 'var(--mint-2)', marginTop: 4, display: 'block', fontFamily: 'var(--mono)', fontWeight: 700 }}>
            {el.role === 'personnalise' && el.roleLabel ? `Toujours rempli avec : ${el.roleLabel}` : T('aiRoleFillHint')}
          </span>
        )}
      </PropRow>
    </>
  );
}

function ShapeProperties({ el, onChange, brandColors }: { el: RectEl | CircleEl | StarEl; onChange: (u: Partial<typeof el>) => void; brandColors?: string[] }) {
  const T = useTranslations('editor');
  return (
    <>
      <ColorRow label={T('color')} value={el.fill} onChange={v => onChange({ fill: v } as any)} brandColors={brandColors} />
      <ColorRow label={T('borderLabel')} value={el.stroke || '#000000'} onChange={v => onChange({ stroke: v } as any)} brandColors={brandColors} />
      <PropRow label={T('thicknessVal', { n: el.strokeWidth })}>
        <input type="range" min={0} max={10} value={el.strokeWidth} onChange={e => onChange({ strokeWidth: Number(e.target.value) } as any)} style={{ width: '100%', accentColor: 'var(--mint-2)' }} />
      </PropRow>
      {el.type === 'rect' && (
        <PropRow label={T('roundingVal', { n: el.cornerRadius })}>
          <input type="range" min={0} max={50} value={el.cornerRadius} onChange={e => onChange({ cornerRadius: Number(e.target.value) } as any)} style={{ width: '100%', accentColor: 'var(--mint-2)' }} />
        </PropRow>
      )}
      <PropRow label={T('opacityVal', { n: el.opacity })}>
        <input type="range" min={0} max={100} value={el.opacity} onChange={e => onChange({ opacity: Number(e.target.value) } as any)} style={{ width: '100%', accentColor: 'var(--mint-2)' }} />
      </PropRow>
    </>
  );
}

function ImageProperties({ el, onChange, onSetBg, onCrop }: { el: ImageEl; onChange: (u: Partial<ImageEl>) => void; onSetBg: () => void; onCrop?: () => void }) {
  const T = useTranslations('editor');
  return (
    <>
      <PropRow label={T('opacityVal', { n: el.opacity })}>
        <input type="range" min={0} max={100} value={el.opacity} onChange={e => onChange({ opacity: Number(e.target.value) })} style={{ width: '100%', accentColor: 'var(--mint-2)' }} />
      </PropRow>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <button onClick={onCrop} className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: 'center' }}>
          {T('crop')}
        </button>
        <button onClick={onSetBg} className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: 'center' }}>
          {T('asBackground')}
        </button>
      </div>
    </>
  );
}

// ─── Layer helpers ────────────────────────────────────────────────────────────

const VECTOR_LABELS: Record<VectorEl['shape'], string> = { rectangle: 'Rectangle', circle: 'Rond', triangle: 'Triangle', star: 'Étoile', pill: 'Pilule', arrow: 'Flèche', diamond: 'Losange', hexagon: 'Hexagone', custom: 'Tracé libre' };

function layerName(el: CanvasEl): string {
  if (el.type === 'text') return (el as TextEl).text.slice(0, 18) || 'Texte';
  if (el.type === 'image') return 'Image';
  if (el.type === 'rect') return 'Rectangle';
  if (el.type === 'circle') return 'Cercle';
  if (el.type === 'star') return 'Étoile';
  if (el.type === 'vector') return VECTOR_LABELS[(el as VectorEl).shape] ?? 'Forme';
  return 'Élément';
}

// ─── Context toolbar (floating in topbar center when element selected) ────────

interface CtxToolbarProps {
  sel: CanvasEl;
  /** Le sélecteur de polices, par groupes : charte de la marque, bibliothèque
   *  du compte, catalogue. Une liste plate de cent dix lignes ne se parcourt
   *  pas — c'est le nombre qui rend le regroupement et la recherche obligatoires. */
  fontGroups: { label: string; fonts: string[] }[];
  brandFamilies?: FontFamily[];
  brandColors: string[];
  stageW: number;
  stageH: number;
  onUpdate: (patch: Partial<CanvasEl>) => void;
  onAlign: (dir: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onCrop?: () => void;
  onSetBg?: () => void;
  onMaskPhoto?: () => void;
  onRemoveBg?: () => void;
  bgRemoving?: boolean;
  onLayerAction: (action: 'front' | 'forward' | 'backward' | 'back') => void;
  onOpenFx?: (p: 'effects' | 'position') => void;
  fxPanel?: 'effects' | 'position' | null;
}

/** Une ligne du sélecteur, rendue DANS sa propre police.
 *  La feuille de style n'est demandée que lorsque la ligne entre à l'écran :
 *  cent dix familles chargées à l'ouverture du menu, c'est autant de requêtes
 *  pour un choix qui n'en concerne qu'une. */
function LigneDePolice({ famille, choisie, onChoisir }: { famille: string; choisie: boolean; onChoisir: () => void }) {
  const ref = React.useRef<HTMLButtonElement>(null);
  const demandee = React.useRef(false);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !demandee.current) { demandee.current = true; assurerPolicesGoogle([famille]); }
    }, { rootMargin: '160px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [famille]);
  return (
    <button ref={ref} onClick={onChoisir}
      style={{ display: 'flex', alignItems: 'center', padding: '7px 10px', borderRadius: 8, width: '100%', background: choisie ? 'var(--mint-soft)' : 'transparent', cursor: 'pointer', border: 'none', textAlign: 'left' }}
      onMouseEnter={e => { if (!choisie) (e.currentTarget as HTMLElement).style.background = 'var(--sunk)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = choisie ? 'var(--mint-soft)' : 'transparent'; }}>
      <span style={{ fontFamily: `"${famille}", sans-serif`, fontWeight: 700, fontSize: 15, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{famille}</span>
      {choisie && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--mint-2)" strokeWidth="2.5" strokeLinecap="round" style={{ marginLeft: 'auto', flexShrink: 0 }}><path d="M4 12.5l5 5 11-11"/></svg>}
    </button>
  );
}

function EditorContextToolbar({ sel, fontGroups, brandFamilies, brandColors, stageW, stageH, onUpdate, onAlign, onDuplicate, onDelete, onCrop, onSetBg, onMaskPhoto, onRemoveBg, bgRemoving, onLayerAction, onOpenFx, fxPanel }: CtxToolbarProps) {
  const T = useTranslations('editor');
  const [pop, setPop] = React.useState<string | null>(null);
  const [fontQuery, setFontQuery] = React.useState('');
  // La recherche porte sur TOUS les groupes à la fois : on cherche une police par
  // son nom, pas par l'endroit d'où elle vient.
  const groupesFiltres = React.useMemo(() => {
    const q = fontQuery.trim().toLowerCase();
    return fontGroups
      .map(g => ({ label: g.label, fonts: q ? g.fonts.filter(f => f.toLowerCase().includes(q)) : g.fonts }))
      .filter(g => g.fonts.length > 0);
  }, [fontGroups, fontQuery]);
  // Le champ se vide à la fermeture : rouvrir le menu sur un filtre laissé la
  // veille donne l'impression que le catalogue a rétréci.
  React.useEffect(() => { if (pop !== 'font') setFontQuery(''); }, [pop]);
  const u = (patch: Partial<CanvasEl>) => onUpdate(patch);
  const isText = sel.type === 'text';
  const isShape = sel.type === 'rect' || sel.type === 'circle' || sel.type === 'star' || sel.type === 'vector';
  const isImage = sel.type === 'image';
  const isVector = sel.type === 'vector';
  const textSel = isText ? sel as TextEl : null;
  const rectSel = sel.type === 'rect' ? sel as RectEl : null;
  const vecSel = isVector ? sel as VectorEl : null;
  // Tout ce qui a un cadre rectangulaire peut être arrondi : le rectangle des
  // formes (type 'vector'), l'ancien type 'rect', et les images importées.
  const roundSel = (sel.type === 'rect' || sel.type === 'image' || (sel.type === 'vector' && (sel as VectorEl).shape === 'rectangle'))
    ? sel as RectEl | ImageEl | VectorEl
    : null;

  const Div = () => <span style={{ width: 1, height: 22, background: 'var(--line)', margin: '0 4px', flexShrink: 0 }} />;
  const IBtn = ({ icon, on, title, onClick, danger }: { icon: React.ReactNode; on?: boolean; title: string; onClick: () => void; danger?: boolean }) => (
    <button title={title} onClick={onClick}
      style={{ width: 36, height: 36, borderRadius: 9, display: 'grid', placeItems: 'center', flexShrink: 0, border: 'none', cursor: 'pointer', transition: 'background .1s',
        color: danger ? '#C4452F' : on ? 'var(--mint-2)' : 'var(--ink)',
        background: on ? 'var(--mint-soft)' : 'transparent' }}
      onMouseEnter={e => { if (!on && !danger) (e.currentTarget as HTMLElement).style.background = 'var(--sunk)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = on ? 'var(--mint-soft)' : 'transparent'; }}>
      {icon}
    </button>
  );
  const TextBtn = ({ on, onClick, children }: { on?: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button onClick={onClick}
      style={{ height: 36, padding: '0 11px', borderRadius: 9, display: 'flex', alignItems: 'center', gap: 6, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, flexShrink: 0, background: on ? 'var(--mint-soft)' : 'transparent', color: on ? 'var(--mint-2)' : 'var(--ink)' }}
      onMouseEnter={e => { if (!on) (e.currentTarget as HTMLElement).style.background = 'var(--sunk)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = on ? 'var(--mint-soft)' : 'transparent'; }}>
      {children}
    </button>
  );
  const SliderRow = ({ label, value, min, max, step, fmt, onChange }: { label: string; value: number; min: number; max: number; step: number; fmt: (v: number) => string; onChange: (v: number) => void }) => (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span className="label" style={{ marginBottom: 0 }}>{label}</span>
        <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 11, color: 'var(--ink-2)' }}>{fmt(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))} className="ed-range" style={{ width: '100%', ...rangeFill(value, min, max) }} />
    </div>
  );
  const toggleDecoration = (flag: 'underline' | 'line-through') => {
    if (!textSel) return;
    const cur = textSel.textDecoration ?? '';
    const parts = (['underline', 'line-through'] as const).filter(f => f === flag ? !cur.includes(f) : cur.includes(f));
    u({ textDecoration: parts.join(' ') } as Partial<TextEl>);
  };
  const colorVal = textSel?.fill ?? (vecSel?.fill ?? (sel.type === 'rect' ? (sel as RectEl).fill : sel.type === 'circle' ? (sel as CircleEl).fill : sel.type === 'star' ? (sel as StarEl).fill : '#000'));
  const setFill = (c: string) => {
    if (textSel) u({ fill: c } as Partial<TextEl>);
    else if (isVector) u({ fill: c } as Partial<VectorEl>);
    else if (isShape) u({ fill: c } as Partial<RectEl>);
  };
  const gradSel = (isText || isShape) ? (sel as TextEl | RectEl | CircleEl | StarEl | VectorEl) : null;
  const setFillType = (ft: 'color' | 'gradient') => {
    if (textSel) u({ fillType: ft } as Partial<TextEl>);
    else if (isVector) u({ fillType: ft } as Partial<VectorEl>);
    else if (isShape) u({ fillType: ft } as Partial<RectEl>);
  };
  const setFillTo = (c: string) => {
    if (textSel) u({ fillTo: c } as Partial<TextEl>);
    else if (isVector) u({ fillTo: c } as Partial<VectorEl>);
    else if (isShape) u({ fillTo: c } as Partial<RectEl>);
  };
  const setFillAngle = (a: number) => {
    if (textSel) u({ fillAngle: a } as Partial<TextEl>);
    else if (isVector) u({ fillAngle: a } as Partial<VectorEl>);
    else if (isShape) u({ fillAngle: a } as Partial<RectEl>);
  };

  const popStyle: React.CSSProperties = { position: 'absolute', top: 'calc(100% + 8px)', left: 0, background: '#fff', borderRadius: 12, padding: 12, boxShadow: '0 18px 44px -14px rgba(13,15,10,.28), 0 0 0 1px rgba(13,15,10,.06)', zIndex: 100, minWidth: 220 };

  // Les panneaux flottants sont ancrés sous leur bouton. Tels quels, ils
  // sortaient par le bord droit dès que la barre d'outils était décalée — ce
  // qui arrive quand le panneau latéral gauche est ouvert : le panneau devenait
  // alors invisible. On les recale donc dans la fenêtre après affichage.
  // Un seul panneau est ouvert à la fois (état `pop`), d'où une ref partagée.
  const popRef = React.useRef<HTMLDivElement>(null);
  const [popDx, setPopDx] = React.useState(0);
  const [popMaxH, setPopMaxH] = React.useState(0);
  React.useLayoutEffect(() => {
    if (!pop) { setPopDx(0); setPopMaxH(0); return; }
    const fit = () => {
      const el = popRef.current;
      if (!el) return;
      const m = 8;
      // Mesure à la position d'ancrage : on neutralise le décalage courant,
      // sinon chaque recalage se cumulerait au précédent.
      const prev = el.style.transform;
      el.style.transform = 'none';
      const r = el.getBoundingClientRect();
      el.style.transform = prev;
      let d = 0;
      if (r.right > window.innerWidth - m) d = window.innerWidth - m - r.right;
      if (r.left + d < m) d = m - r.left;
      setPopDx(d);
      setPopMaxH(Math.max(120, window.innerHeight - r.top - m));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [pop]);
  // Attributs communs à tous les panneaux : ancrage + recalage + hauteur bornée.
  const popAttrs = (extra?: React.CSSProperties) => {
    const asked = typeof extra?.maxHeight === 'number' ? extra.maxHeight : Infinity;
    return {
      ref: popRef,
      style: {
        ...popStyle,
        ...extra,
        maxHeight: popMaxH > 0 ? Math.min(asked, popMaxH) : extra?.maxHeight,
        overflowY: 'auto' as const,
        transform: popDx ? `translateX(${popDx}px)` : undefined,
      } as React.CSSProperties,
    };
  };

  return (
    <div className="pop-in" style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#fff', borderRadius: 14, padding: '7px 12px', boxShadow: '0 8px 26px -10px rgba(13,15,10,.2), 0 0 0 1px rgba(13,15,10,.06)', overflow: 'visible', position: 'relative' }}>

      {/* TEXT controls */}
      {textSel && <>
        {/* Font family */}
        <div style={{ position: 'relative' }}>
          <button onClick={() => setPop(p => p === 'font' ? null : 'font')}
            style={{ height: 32, padding: '0 9px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6, background: 'var(--sunk)', border: 'none', cursor: 'pointer', minWidth: 100, maxWidth: 140 }}>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: `"${textSel.fontFamily}", sans-serif`, fontWeight: 600, fontSize: 12.5, color: 'var(--ink)' }}>{textSel.fontFamily}</span>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 9l6 6 6-6"/></svg>
          </button>
          {pop === 'font' && (
            <div {...popAttrs({ maxHeight: 340, width: 268 })}>
              <input
                autoFocus
                value={fontQuery}
                onChange={e => setFontQuery(e.target.value)}
                placeholder="Rechercher une police"
                style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', marginBottom: 6, border: '1px solid var(--line)', borderRadius: 8, fontSize: 12.5, fontFamily: 'var(--sans)', outline: 'none', background: 'var(--white)', color: 'var(--ink)' }} />
              {groupesFiltres.length === 0 && (
                <p style={{ margin: '10px 4px', fontSize: 12.5, color: 'var(--ink-3)' }}>Aucune police pour « {fontQuery} »</p>
              )}
              {groupesFiltres.map(g => (
                <div key={g.label}>
                  <p style={{ margin: '8px 4px 3px', fontSize: 10, fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>{g.label}</p>
                  {g.fonts.map(f => (
                    <LigneDePolice key={f} famille={f} choisie={textSel.fontFamily === f}
                      onChoisir={() => {
                        assurerPolicesGoogle([f]);
                        // Le rôle disparaît : ce calque n'appartient plus à la
                        // charte, un changement de typographie ne le touchera pas.
                        u({ fontFamily: f, fontRole: '' } as Partial<TextEl>);
                        setPop(null);
                      }} />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
        {/* Size stepper */}
        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--sunk)', borderRadius: 8, height: 32, marginLeft: 4, flexShrink: 0 }}>
          <button onClick={() => u({ fontSize: Math.max(8, textSel.fontSize - 2) } as Partial<TextEl>)} style={{ width: 26, height: 32, display: 'grid', placeItems: 'center', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ink)' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14"/></svg>
          </button>
          <input type="number" value={textSel.fontSize} onChange={e => { const v = parseInt(e.target.value) || 8; u({ fontSize: Math.min(400, Math.max(8, v)) } as Partial<TextEl>); }}
            style={{ width: 32, textAlign: 'center', border: 'none', background: 'transparent', fontWeight: 700, fontSize: 12.5, outline: 'none', color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }} />
          <button onClick={() => u({ fontSize: Math.min(400, textSel.fontSize + 2) } as Partial<TextEl>)} style={{ width: 26, height: 32, display: 'grid', placeItems: 'center', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ink)' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
          </button>
        </div>
        <Div />
        {/* Bold */}
        <IBtn title={T('bold')} on={textSel.fontStyle?.includes('bold')}
          onClick={() => u({ fontStyle: textSel.fontStyle?.includes('bold') ? (textSel.fontStyle.includes('italic') ? 'italic' : 'normal') : (textSel.fontStyle?.includes('italic') ? 'bold italic' : 'bold') } as Partial<TextEl>)}
          icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z"/></svg>} />
        {/* Italic */}
        <IBtn title={T('italic')} on={textSel.fontStyle?.includes('italic')}
          onClick={() => u({ fontStyle: textSel.fontStyle?.includes('italic') ? (textSel.fontStyle.includes('bold') ? 'bold' : 'normal') : (textSel.fontStyle?.includes('bold') ? 'bold italic' : 'italic') } as Partial<TextEl>)}
          icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5h7M6 19h7M14 5l-4 14"/></svg>} />
        {/* Underline */}
        <IBtn title={T('underline')} on={textSel.textDecoration?.includes('underline')}
          onClick={() => toggleDecoration('underline')}
          icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 4v7a5 5 0 0 0 10 0V4M5 21h14"/></svg>} />
        {/* Strikethrough */}
        <IBtn title={T('strikethrough')} on={textSel.textDecoration?.includes('line-through')}
          onClick={() => toggleDecoration('line-through')}
          icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M16 4H9a3 3 0 0 0-2.83 4M14 20c-2.8 0-5-1.1-5-4M4 12h16"/></svg>} />
        {/* Case */}
        <IBtn title={textSel.uppercase ? T('lowercase') : T('uppercaseTitle')} on={!!textSel.uppercase}
          onClick={() => u({ uppercase: !textSel.uppercase } as any)}
          icon={<span style={{ fontWeight: 800, fontSize: 11.5, fontFamily: 'system-ui', lineHeight: 1, letterSpacing: '-0.02em', display: 'flex', alignItems: 'baseline', gap: 0 }}>A<span style={{ fontSize: 9 }}>a</span></span>} />
        <Div />
        {/* Align cycle */}
        <IBtn title={`Alignement: ${textSel.align}`} on={false}
          onClick={() => u({ align: textSel.align === 'left' ? 'center' : textSel.align === 'center' ? 'right' : 'left' } as Partial<TextEl>)}
          icon={textSel.align === 'center'
            ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M7 12h10M5 18h14"/></svg>
            : textSel.align === 'right'
              ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M10 12h10M7 18h13"/></svg>
              : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h10M4 18h13"/></svg>
          } />
        {/* Spacing (line-height + letter-spacing) */}
        <div style={{ position: 'relative' }}>
          <IBtn title={T('spacing')} on={pop === 'spacing'}
            onClick={() => setPop(p => p === 'spacing' ? null : 'spacing')}
            icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 6h13M8 12h13M8 18h13M3 6v.01M3 12v.01M3 18v.01"/></svg>} />
          {pop === 'spacing' && (
            <div {...popAttrs()}>
              <SliderRow label={T('lineHeight')} value={textSel.lineHeight ?? 1.2} min={0.8} max={3} step={0.05}
                fmt={v => v.toFixed(2)} onChange={v => u({ lineHeight: v } as any)} />
              <SliderRow label={T('letterSpacing')} value={textSel.letterSpacing ?? 0} min={-5} max={30} step={0.5}
                fmt={v => (v >= 0 ? '+' : '') + v.toFixed(1) + 'px'} onChange={v => u({ letterSpacing: v } as any)} />
            </div>
          )}
        </div>
        {/* Graisses de la famille : n'apparaît que si la police choisie est une
            famille de la charte importée avec plusieurs variantes. Konva accepte
            une graisse numérique dans fontStyle (« italic 700 » = CSS valide). */}
        {(() => {
          // Police importée par le client d'abord, sinon les variantes réelles de
          // la famille Google : dans les deux cas on ne propose que ce qui existe.
          const brand = brandFamilies?.find(f => f.family === textSel.fontFamily);
          const variants = brand && brand.variants.length > 1
            ? brand.variants.map(v => ({ weight: v.weight, italic: v.italic }))
            : googleVariants(textSel.fontFamily);
          if (variants.length < 2) return null;
          // Les anciens calques portent « bold »/« normal » : on les fait
          // correspondre à 700/400 pour que le menu s'ouvre sur la bonne ligne.
          const raw = textSel.fontStyle ?? 'normal';
          const italic = raw.includes('italic');
          const numeric = raw.match(/\d{3}/)?.[0];
          const weight = numeric ? Number(numeric) : (raw.includes('bold') ? 700 : 400);
          const cur = `${italic ? 'italic ' : ''}${weight}`;
          return (
            <select
              value={variants.some(v => `${v.italic ? 'italic ' : ''}${v.weight}` === cur) ? cur : `${weight}`}
              onChange={e => u({ fontStyle: e.target.value } as Partial<TextEl>)}
              title={T('weightTitle')}
              style={{ height: 32, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--white)', color: 'var(--ink)', fontSize: 12, fontWeight: 700, fontFamily: 'var(--sans)', padding: '0 8px', cursor: 'pointer', maxWidth: 150 }}>
              {variants.map(v => {
                const val = `${v.italic ? 'italic ' : ''}${v.weight}`;
                return <option key={val} value={val}>{weightName(v.weight)}{v.italic ? ' Italic' : ''}</option>;
              })}
            </select>
          );
        })()}
        {/* Effets → ouvre le panneau gauche (aperçus façon Canva) */}
        <TextBtn on={fxPanel === 'effects'} onClick={() => onOpenFx?.('effects')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M1 12h3M20 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/></svg>
          {T('effect')}
        </TextBtn>
      </>}

      {/* COLOR — text fill or shape fill */}
      {(isText || isShape) && (
        <ColorPicker value={colorVal} onChange={(c: string) => setFill(c)} brandColors={brandColors} />
      )}

      {/* GRADIENT — dégradé sur texte ou forme (rect/circle/star ; vector a son propre sélecteur plus bas) */}
      {(isText || isShape) && !isVector && gradSel && (
        <div style={{ position: 'relative' }}>
          <IBtn title={T('gradient')} on={gradSel.fillType === 'gradient'} onClick={() => setPop(p => p === 'grad' ? null : 'grad')}
            icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><defs><linearGradient id="ed-grad-icon" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="currentColor" stopOpacity="1" /><stop offset="1" stopColor="currentColor" stopOpacity="0.15" /></linearGradient></defs><rect x="3" y="3" width="18" height="18" rx="4" fill="url(#ed-grad-icon)" /><rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="1.6" strokeOpacity=".55" /></svg>} />
          {pop === 'grad' && (
            <div {...popAttrs({ minWidth: 220 })}>
              <div className="label" style={{ marginBottom: 8 }}>{T('fill')}</div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                {(['color', 'gradient'] as const).map(ft => (
                  <button key={ft} onClick={() => setFillType(ft)}
                    style={{ flex: 1, padding: '6px 4px', borderRadius: 7, border: (gradSel.fillType ?? 'color') === ft ? '2px solid var(--mint-2)' : '1.5px solid var(--line)', cursor: 'pointer', background: (gradSel.fillType ?? 'color') === ft ? 'var(--mint-soft)' : 'var(--sunk)', fontSize: 11, fontWeight: 700, color: (gradSel.fillType ?? 'color') === ft ? 'var(--mint-2)' : 'var(--ink-3)' }}>
                    {ft === 'color' ? 'Couleur unie' : 'Dégradé'}
                  </button>
                ))}
              </div>
              {gradSel.fillType === 'gradient' && <>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginBottom: 4 }}>{T('start')}</div>
                    <ColorPicker value={colorVal} onChange={(c: string) => setFill(c)} brandColors={brandColors} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginBottom: 4 }}>{T('end')}</div>
                    <ColorPicker value={gradSel.fillTo ?? '#ffffff'} onChange={(c: string) => setFillTo(c)} brandColors={brandColors} />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span className="label" style={{ marginBottom: 0 }}>{T('angle')}</span>
                  <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 11, color: 'var(--ink-2)' }}>{gradSel.fillAngle ?? 90}°</span>
                </div>
                <input type="range" min={0} max={360} step={5} value={gradSel.fillAngle ?? 90} onChange={e => setFillAngle(parseInt(e.target.value))} className="ed-range" style={{ width: '100%', ...rangeFill(gradSel.fillAngle ?? 90, 0, 360) }} />
              </>}
            </div>
          )}
        </div>
      )}

      {/* Le fond de texte a désormais UN SEUL endroit : l'effet « Arrière-plan »
          du panneau Effet, qui épouse chaque ligne. L'ancien « Fond coloré » de
          cette barre était une seconde implémentation, indépendante et moins
          bonne : deux réglages pour la même chose, qui ne se parlaient pas. */}

      {/* VECTOR — stroke controls */}
      {vecSel && (
        <div style={{ position: 'relative' }}>
          <IBtn title={T('outline')} on={pop === 'vstroke'}
            onClick={() => setPop(p => p === 'vstroke' ? null : 'vstroke')}
            icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="3"/></svg>} />
          {pop === 'vstroke' && (
            <div {...popAttrs({ minWidth: 220 })}>
              <div className="label" style={{ marginBottom: 8 }}>{T('outline')}</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                <ColorPicker value={vecSel.stroke || '#000000'} onChange={c => u({ stroke: c } as Partial<VectorEl>)} />
                <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{T('colorLower')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span className="label" style={{ marginBottom: 0 }}>{T('thickness')}</span>
                <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 11, color: 'var(--ink-2)' }}>{vecSel.strokeWidth}px</span>
              </div>
              <input type="range" min={0} max={20} step={1} value={vecSel.strokeWidth} onChange={e => u({ strokeWidth: parseInt(e.target.value) } as Partial<VectorEl>)} className="ed-range" style={{ width: '100%', ...rangeFill(vecSel.strokeWidth, 0, 20) }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, marginBottom: 5 }}>
                <span className="label" style={{ marginBottom: 0 }}>{T('fill')}</span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['color','gradient','none','image'] as const).map(ft => (
                  <button key={ft}
                    onClick={() => ft === 'image' ? (onMaskPhoto?.(), setPop(null)) : u({ fillType: ft } as Partial<VectorEl>)}
                    style={{ flex: 1, padding: '5px 4px', borderRadius: 7, border: vecSel.fillType === ft ? '2px solid var(--mint-2)' : '1.5px solid var(--line)', cursor: 'pointer', background: vecSel.fillType === ft ? 'var(--mint-soft)' : 'var(--sunk)', fontSize: 10.5, fontWeight: 700, color: vecSel.fillType === ft ? 'var(--mint-2)' : 'var(--ink-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                    {ft === 'color' ? 'Couleur' : ft === 'gradient' ? 'Dégradé' : ft === 'none' ? 'Aucun' : <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>{T('photo')}</>}
                  </button>
                ))}
              </div>
              {vecSel.fillType === 'gradient' && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginBottom: 4 }}>{T('start')}</div>
                      <ColorPicker value={vecSel.fill} onChange={(c: string) => setFill(c)} brandColors={brandColors} />
                    </div>
                    <div>
                      <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginBottom: 4 }}>{T('end')}</div>
                      <ColorPicker value={vecSel.fillTo ?? '#ffffff'} onChange={(c: string) => setFillTo(c)} brandColors={brandColors} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span className="label" style={{ marginBottom: 0 }}>{T('angle')}</span>
                    <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 11, color: 'var(--ink-2)' }}>{vecSel.fillAngle ?? 90}°</span>
                  </div>
                  <input type="range" min={0} max={360} step={5} value={vecSel.fillAngle ?? 90} onChange={e => setFillAngle(parseInt(e.target.value))} className="ed-range" style={{ width: '100%', ...rangeFill(vecSel.fillAngle ?? 90, 0, 360) }} />
                </div>
              )}
              {vecSel.fillType === 'image' && vecSel.imageSrc && (
                <button onClick={() => { onMaskPhoto?.(); setPop(null); }} style={{ marginTop: 8, width: '100%', padding: '5px', borderRadius: 7, border: '1.5px solid var(--line)', cursor: 'pointer', background: 'var(--sunk)', fontSize: 11, fontWeight: 700, color: 'var(--ink-3)' }}>
                  Changer la photo
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* SHAPE extra — corner radius for rect */}
      {/* Arrondi — pour un rectangle comme pour une image importée. Le maximum suit
          l'objet (moitié de son plus petit côté = coins parfaitement ronds) au lieu
          d'un plafond fixe à 50 px qui ne voulait rien dire sur un grand cadre. */}
      {roundSel && (() => {
        const maxR = Math.max(1, Math.round(Math.min(roundSel.width, roundSel.height) / 2));
        const cur = Math.min(roundSel.cornerRadius ?? 0, maxR);
        return (
        <div style={{ position: 'relative' }}>
          <IBtn title={T('rounding')} on={pop === 'radius'}
            onClick={() => setPop(p => p === 'radius' ? null : 'radius')}
            icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="4"/></svg>} />
          {pop === 'radius' && (
            <div {...popAttrs()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span className="label" style={{ marginBottom: 0 }}>{T('rounding')}</span>
                <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 11, color: 'var(--ink-2)' }}>{cur}px</span>
              </div>
              <input type="range" min={0} max={maxR} step={1} value={cur} onChange={e => u({ cornerRadius: parseInt(e.target.value) } as Partial<RectEl>)} className="ed-range" style={{ width: '100%', ...rangeFill(cur, 0, maxR) }} />
              <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                {[0, Math.round(maxR * 0.15), Math.round(maxR * 0.4), maxR].map((r, i) => (
                  <button key={i} onClick={() => u({ cornerRadius: r } as Partial<RectEl>)}
                    style={{ flex: 1, padding: '4px 0', borderRadius: 6, cursor: 'pointer', fontSize: 10.5, fontWeight: 700,
                      border: cur === r ? '1.5px solid var(--mint-2)' : '1.5px solid var(--line)',
                      background: cur === r ? 'var(--mint-soft)' : 'var(--sunk)', color: cur === r ? 'var(--mint-2)' : 'var(--ink-3)' }}>
                    {['Net', 'Doux', 'Rond', 'Max'][i]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        );
      })()}

      {/* IMAGE controls */}
      {isImage && (() => {
        const imgSel = sel as ImageEl;
        // Retourne du JSX inline (appel de fonction, pas un composant) pour garder le même
        // nœud DOM entre les rendus → le glissement du slider ne se casse pas.
        const adjRow = (label: string, k: 'adjBrightness' | 'adjContrast' | 'adjSaturation' | 'adjWarmth' | 'adjTint' | 'adjBlur', min: number, max: number, unit = '') => {
          const val = (imgSel[k] as number) || 0;
          return (
            <div key={k} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span className="label" style={{ marginBottom: 0 }}>{label}</span>
                <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 11, color: 'var(--ink-2)' }}>{val > 0 && min < 0 ? '+' : ''}{val}{unit}</span>
              </div>
              <input type="range" min={min} max={max} step={1} value={val}
                onChange={e => u({ [k]: parseInt(e.target.value) } as Partial<ImageEl>)} className="ed-range" style={{ width: '100%', ...rangeFill(val, min, max) }} />
            </div>
          );
        };
        return <>
          {onSetBg && <button onClick={onSetBg} className="btn btn-ghost btn-sm" style={{ height: 30, flexShrink: 0 }}>{T('asBackground')}</button>}
          {onCrop && <button onClick={onCrop} className="btn btn-ghost btn-sm" style={{ height: 30, flexShrink: 0 }}>{T('crop')}</button>}
          {onRemoveBg && (
            <button onClick={onRemoveBg} disabled={bgRemoving} className="btn btn-ghost btn-sm" style={{ height: 30, flexShrink: 0, opacity: bgRemoving ? 0.6 : 1 }}>
              {bgRemoving ? 'Détourage…' : 'Détourer'}
            </button>
          )}
          <div style={{ position: 'relative' }}>
            <TextBtn on={pop === 'adjust'} onClick={() => setPop(p => p === 'adjust' ? null : 'adjust')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/><circle cx="9" cy="6" r="2.4" fill="var(--paper)"/><circle cx="15" cy="12" r="2.4" fill="var(--paper)"/><circle cx="8" cy="18" r="2.4" fill="var(--paper)"/></svg>
              Ajuster
            </TextBtn>
            {pop === 'adjust' && (
              <div {...popAttrs({ minWidth: 244 })}>
                <span className="label" style={{ display: 'block', marginBottom: 8 }}>{T('filters')}</span>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                  {PHOTO_FILTER_PRESETS.map(p => {
                    const active = PHOTO_FILTER_PRESETS.every(o => o.id !== p.id ? true :
                      (['adjBrightness', 'adjContrast', 'adjSaturation', 'adjWarmth', 'adjTint'] as const)
                        .every(k => ((imgSel[k] as number) || 0) === (p.values[k] ?? 0)));
                    return (
                      <button key={p.id} onClick={() => u({ adjBrightness: 0, adjContrast: 0, adjSaturation: 0, adjWarmth: 0, adjTint: 0, ...p.values } as Partial<ImageEl>)}
                        className="btn btn-ghost btn-sm" style={{ height: 28, padding: '0 10px', fontSize: 11.5, background: active ? 'var(--mint-soft)' : undefined, color: active ? 'var(--mint-2)' : undefined, boxShadow: active ? 'inset 0 0 0 1.5px var(--mint-2)' : undefined }}>
                        {p.name}
                      </button>
                    );
                  })}
                </div>
                <span className="label" style={{ display: 'block', marginBottom: 8 }}>{T('light')}</span>
                {adjRow('Luminosité', 'adjBrightness', -100, 100)}
                {adjRow('Contraste', 'adjContrast', -100, 100)}
                <span className="label" style={{ display: 'block', margin: '12px 0 8px' }}>{T('color')}</span>
                {adjRow('Saturation', 'adjSaturation', -100, 100)}
                {adjRow('Chaleur', 'adjWarmth', -100, 100)}
                {adjRow('Teinte', 'adjTint', -100, 100)}
                <span className="label" style={{ display: 'block', margin: '12px 0 8px' }}>{T('effect')}</span>
                {adjRow('Flou', 'adjBlur', 0, 40, 'px')}
                <button onClick={() => u({ adjBrightness: 0, adjContrast: 0, adjSaturation: 0, adjWarmth: 0, adjTint: 0, adjBlur: 0 } as Partial<ImageEl>)}
                  className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}>{T('reset')}</button>
              </div>
            )}
          </div>
        </>;
      })()}

      <Div />

      {/* OPACITY */}
      <div style={{ position: 'relative' }}>
        <IBtn title={`Opacité ${sel.opacity}%`} on={pop === 'opacity'}
          onClick={() => setPop(p => p === 'opacity' ? null : 'opacity')}
          icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2.5"/><path d="M3 9h6V3M9 15h6V9M15 21v-6h6" fill="currentColor" stroke="none" opacity=".25"/></svg>} />
        {pop === 'opacity' && (
          <div {...popAttrs({ left: 'auto', right: 0 })}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span className="label" style={{ marginBottom: 0 }}>{T('opacity')}</span>
              <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 11, color: 'var(--ink-2)' }}>{sel.opacity}%</span>
            </div>
            <input type="range" min={0} max={100} step={1} value={sel.opacity} onChange={e => u({ opacity: parseInt(e.target.value) } as Partial<CanvasEl>)} className="ed-range" style={{ width: '100%', ...rangeFill(sel.opacity, 0, 100) }} />
          </div>
        )}
      </div>

      {/* Animer */}
      <div style={{ position: 'relative' }}>
        <TextBtn on={pop === 'anim'} onClick={() => setPop(p => p === 'anim' ? null : 'anim')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 3l14 9-14 9V3z"/></svg>
          Animer
        </TextBtn>
        {pop === 'anim' && (
          <div {...popAttrs({ right: 0, left: 'auto', minWidth: 200, textAlign: 'center', padding: '20px 16px' })}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)', marginBottom: 6 }}>{T('comingSoon')}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.4 }}>{T('animComingSoon')}</div>
          </div>
        )}
      </div>

      {/* Position → ouvre le panneau gauche (organiser + aligner + avancé) */}
      <TextBtn on={fxPanel === 'position'} onClick={() => onOpenFx?.('position')}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
        Position
      </TextBtn>

      <Div />

      {/* DUPLICATE */}
      <IBtn title={T('duplicate')} onClick={onDuplicate}
        icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="11" height="11" rx="2.2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/></svg>} />
      {/* DELETE */}
      <IBtn title={T('delete')} danger onClick={onDelete}
        icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M9 7V4.5h6V7M6 7l1 13h10l1-13"/></svg>} />
    </div>
  );
}

// ─── SelectionPill (floats above selected element in canvas space) ─────────────

interface PillProps {
  // Encombrement réel de l'objet à l'écran, rotation comprise.
  rect: { left: number; top: number; right: number; bottom: number };
  zoom: number;
  onDuplicate: () => void;
  onDelete: () => void;
  /** Ouvre l'assistant visuel sur le calque sélectionné. */
  onAsk: () => void;
}

function SelectionPill({ rect, zoom, onDuplicate, onDelete, onAsk }: PillProps) {
  const T = useTranslations('editor');
  const pillW = 260;
  // La pastille se pose au-dessus de l'encombrement RÉEL : une boîte non tournée
  // sous-estime la hauteur dès que l'objet est incliné, et la pastille venait
  // alors se poser par-dessus le texte.
  // Toujours au-dessus, jamais en dessous : une pastille qui saute d'un côté à
  // l'autre pendant qu'on fait tourner l'objet se cherche du regard.
  const GAP = 12;        // écart à l'écran entre l'objet et la pastille
  // La couche d'overlay est mise à l'échelle par `zoom` : on contre-scale la barre
  // pour qu'elle garde une taille constante à l'écran (façon Canva).
  return (
    <div style={{
      position: 'absolute',
      left: (rect.left + rect.right) / 2,
      top: rect.top - GAP / zoom,
      width: 0,
      height: 0,
      zIndex: 55,
      pointerEvents: 'auto',
    }}>
    <div style={{
      position: 'absolute', left: 0, top: 0, width: pillW,
      transform: `translate(-50%, -100%) scale(${1 / zoom})`,
      transformOrigin: 'center bottom',
    }}>
      <div className="pop-in" style={{
        display: 'flex', alignItems: 'center', gap: 2,
        background: '#fff', borderRadius: 11, padding: '5px 6px',
        boxShadow: '0 10px 30px -8px rgba(13,15,10,.35), 0 0 0 1px rgba(13,15,10,.05)',
      }}>
        {/* Demander à Klip — même identité que la pastille « Assistant visuel »
            en bas de l'écran : c'est le même interlocuteur, il doit se
            reconnaître au premier coup d'œil. */}
        <button className="klip-ask" onClick={e => { e.stopPropagation(); onAsk(); }} style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px 0 10px', height: 32,
          borderRadius: 16, color: '#fff', fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 13,
          letterSpacing: '-.01em', whiteSpace: 'nowrap', background: 'var(--vio)',
          border: 'none', cursor: 'pointer',
          boxShadow: '0 8px 20px -9px rgba(102,86,217,.85), 0 2px 6px rgba(16,19,11,.16)',
        }}>
          <KlipMark size={22} />
          Demander à Klip
        </button>
        <span style={{ width: 1, height: 18, background: '#E4E3D7', flexShrink: 0 }} />
        {/* Duplicate */}
        <button onClick={e => { e.stopPropagation(); onDuplicate(); }} title={T('duplicate')}
          style={{ width: 30, height: 30, borderRadius: 8, display: 'grid', placeItems: 'center', color: '#3a3d33', background: 'transparent', border: 'none', cursor: 'pointer' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#F1F0E8')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="11" height="11" rx="2.4"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/></svg>
        </button>
        {/* Delete */}
        <button onClick={e => { e.stopPropagation(); onDelete(); }} title={T('delete')}
          style={{ width: 30, height: 30, borderRadius: 8, display: 'grid', placeItems: 'center', color: '#C4452F', background: 'transparent', border: 'none', cursor: 'pointer' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#F1F0E8')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M9 7V4.5h6V7M6 7l1 13h10l1-13"/></svg>
        </button>
      </div>
    </div>
    </div>
  );
}

// ─── Panel head (title + optional sub + close button) ─────────────────────────

function PanelHead({ title, sub, onClose }: { title: string; sub?: string; onClose: () => void }) {
  const T = useTranslations('editor');
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 20 }}>
      <div style={{ minWidth: 0 }}>
        <h3 className="h-title" style={{ fontSize: 20, letterSpacing: '-0.015em' }}>{title}</h3>
        {sub && <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 4 }}>{sub}</div>}
      </div>
      <button onClick={onClose} title={T('close')}
        style={{ marginLeft: 'auto', width: 30, height: 30, borderRadius: 8, display: 'grid', placeItems: 'center', color: 'var(--ink-3)', flexShrink: 0, background: 'transparent', border: 'none', cursor: 'pointer' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--sunk)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6"/></svg>
      </button>
    </div>
  );
}

// ─── Effets (panneau gauche façon Canva, aperçus visuels) ─────────────────────

// Piste de slider remplie en mint jusqu'au curseur (façon Canva).
function rangeFill(v: number, min: number, max: number): React.CSSProperties {
  const pct = Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100));
  return { background: `linear-gradient(to right, var(--mint-2) ${pct}%, var(--sunk) ${pct}%)` };
}

// Réglage générique (slider + stepper façon Canva) pour les panneaux gauche.
function FxSlider({ label, value, min, max, step, fmt, onChange }: { label: string; value: number; min: number; max: number; step: number; fmt: (v: number) => string; onChange: (v: number) => void }) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const stepBtn: React.CSSProperties = { width: 26, height: 30, display: 'grid', placeItems: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ink-2)', fontSize: 16, lineHeight: 1, fontWeight: 600 };
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(parseFloat(e.target.value))} className="ed-range"
          style={{ flex: 1, minWidth: 0, ...rangeFill(value, min, max) }} />
        <div style={{ display: 'flex', alignItems: 'center', height: 32, borderRadius: 8, border: '1px solid var(--line)', background: '#fff', flexShrink: 0 }}>
          <button type="button" onClick={() => onChange(clamp(value - step))} style={stepBtn}>−</button>
          <span style={{ minWidth: 32, textAlign: 'center', fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 12.5, color: 'var(--ink)' }}>{fmt(value)}</span>
          <button type="button" onClick={() => onChange(clamp(value + step))} style={stepBtn}>+</button>
        </div>
      </div>
    </div>
  );
}

// Les effets sont EXCLUSIFS (comme Canva) : appliquer un effet réinitialise les autres.
const FX_CLEAR = { shadowEnabled: false, glowEnabled: false, hollowEnabled: false, liftEnabled: false, echoEnabled: false, highlightEnabled: false, strokeWidth: 0 } as Partial<TextEl>;

function activeEffectKey(el: TextEl): string {
  if (el.highlightEnabled) return 'background';
  if (el.hollowEnabled) return 'hollow';
  if (el.liftEnabled) return 'lift';
  if (el.echoEnabled) return 'echo';
  if (el.glowEnabled) return (el.strokeWidth ?? 0) > 0 && (el.glowIntensity ?? 0) >= 90 ? 'neon' : 'glow';
  if (el.shadowEnabled) return 'shadow';
  if ((el.strokeWidth ?? 0) > 0) return 'border';
  return 'none';
}

function EffectsPanel({ sel, onUpdate, brandColors, onClose }: { sel: TextEl; onUpdate: (patch: Partial<CanvasEl>) => void; brandColors: string[]; onClose: () => void }) {
  const T = useTranslations('editor');
  const u = (patch: Partial<TextEl>) => onUpdate(patch as Partial<CanvasEl>);
  const active = activeEffectKey(sel);

  // Ordre & libellés calqués sur Canva : O. portée · Brillance · Écho / Bordure · Arrière-plan · Élévation / Creux · Néon
  const presets: { key: string; label: string; patch: Partial<TextEl>; preview: React.CSSProperties }[] = [
    { key: 'shadow',     label: 'O. portée',    patch: { ...FX_CLEAR, shadowEnabled: true, shadowColor: '#000000', shadowOpacity: 55, shadowBlur: 6, shadowOffsetX: 4, shadowOffsetY: 4 }, preview: { textShadow: '3px 3px 2px rgba(0,0,0,.4)' } },
    { key: 'glow',       label: 'Brillance',    patch: { ...FX_CLEAR, glowEnabled: true, glowColor: '#FFD34E', glowIntensity: 70, glowSize: 14 }, preview: { textShadow: '0 0 11px #FFD34E, 0 0 5px #FFD34E' } },
    { key: 'echo',       label: 'Écho',         patch: { ...FX_CLEAR, echoEnabled: true, echoColor: '#B9A3FF', echoCount: 3, echoOffset: 8, echoFade: true }, preview: { textShadow: '6px 6px 0 rgba(185,163,255,.55), 11px 11px 0 rgba(185,163,255,.28)' } },
    { key: 'border',     label: 'Bordure',      patch: { ...FX_CLEAR, stroke: '#14160F', strokeWidth: 3 }, preview: { color: '#fff', WebkitTextStroke: '1.4px #14160F' } as React.CSSProperties },
    { key: 'background', label: 'Arrière-plan', patch: { ...FX_CLEAR, highlightEnabled: true, highlightColor: '#FFE45C', highlightOpacity: 100, highlightBorderRadius: 4, highlightPadding: 8 }, preview: { background: '#FFE45C', padding: '2px 6px', borderRadius: 4, color: '#14160F' } },
    { key: 'lift',       label: 'Élévation',    patch: { ...FX_CLEAR, liftEnabled: true, liftColor: '#000000', liftDepth: 5, liftDirection: 'br' }, preview: { textShadow: '0 6px 6px rgba(0,0,0,.3)' } },
    { key: 'hollow',     label: 'Creux',        patch: { ...FX_CLEAR, hollowEnabled: true, stroke: sel.fill || '#14160F', strokeWidth: 2 }, preview: { color: 'transparent', WebkitTextStroke: '1.4px #14160F' } as React.CSSProperties },
    { key: 'neon',       label: 'Néon',         patch: { ...FX_CLEAR, glowEnabled: true, glowColor: '#2FD79B', glowIntensity: 100, glowSize: 20, stroke: '#2FD79B', strokeWidth: 1 }, preview: { color: '#2FD79B', textShadow: '0 0 8px #2FD79B, 0 0 16px #2FD79B' } },
  ];

  return (
    <div style={{ padding: 18 }}>
      {/* En-tête façon Canva : titre + croix de fermeture */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 18 }}>
        <h3 className="h-title" style={{ fontSize: 17 }}>{T('effect')}</h3>
        <button onClick={onClose} title={T('close')}
          style={{ marginLeft: 'auto', width: 30, height: 30, borderRadius: 8, display: 'grid', placeItems: 'center', color: 'var(--ink-3)', background: 'transparent', border: 'none', cursor: 'pointer' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--sunk)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px 12px' }}>
        {presets.map(p => {
          const on = active === p.key;
          const dark = p.key === 'neon';
          return (
            <button key={p.key} onClick={() => u(p.patch)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 8, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}>
              <div style={{ aspectRatio: '1', borderRadius: 10, display: 'grid', placeItems: 'center',
                background: dark ? '#14160F' : (on ? 'var(--mint-soft)' : '#fff'),
                boxShadow: on ? 'inset 0 0 0 2px var(--mint-2)' : 'inset 0 0 0 1px var(--line), 0 1px 3px rgba(20,22,15,.06)',
                transition: 'box-shadow .12s, background .12s' }}
              onMouseEnter={e => { if (!on) e.currentTarget.style.boxShadow = 'inset 0 0 0 1px var(--line), 0 3px 10px rgba(20,22,15,.14)'; }}
              onMouseLeave={e => { if (!on) e.currentTarget.style.boxShadow = 'inset 0 0 0 1px var(--line), 0 1px 3px rgba(20,22,15,.06)'; }}>
                <span style={{ fontFamily: 'var(--display)', fontWeight: 900, fontSize: 28, color: dark ? '#fff' : '#14160F', lineHeight: 1, ...p.preview }}>Ag</span>
              </div>
              <span style={{ fontSize: 11.5, fontWeight: 500, color: on ? 'var(--mint-2)' : 'var(--ink-3)', textAlign: 'center', lineHeight: 1.15 }}>{p.label}</span>
            </button>
          );
        })}
      </div>

      {/* Réglages fins de l'effet actif */}
      {active !== 'none' && (
        <div style={{ marginTop: 18, borderTop: '1px solid var(--line)', paddingTop: 16 }}>

          {active === 'shadow' && (<>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span className="label" style={{ marginBottom: 0 }}>{T('color')}</span>
              <ColorPicker value={sel.shadowColor ?? '#000000'} onChange={c => u({ shadowColor: c })} brandColors={brandColors} />
            </div>
            <FxSlider label={T('opacity')} value={sel.shadowOpacity ?? 55} min={0} max={100} step={1} fmt={v => v + '%'} onChange={v => u({ shadowOpacity: v })} />
            <FxSlider label={T('blur')} value={sel.shadowBlur ?? 6} min={0} max={30} step={1} fmt={v => v + 'px'} onChange={v => u({ shadowBlur: v })} />
            <FxSlider label={T('offsetX')} value={sel.shadowOffsetX ?? 4} min={-20} max={20} step={1} fmt={v => (v >= 0 ? '+' : '') + v} onChange={v => u({ shadowOffsetX: v })} />
            <FxSlider label={T('offsetY')} value={sel.shadowOffsetY ?? 4} min={-20} max={20} step={1} fmt={v => (v >= 0 ? '+' : '') + v} onChange={v => u({ shadowOffsetY: v })} />
          </>)}

          {active === 'lift' && (
            <FxSlider label={T('depth')} value={sel.liftDepth ?? 5} min={1} max={20} step={1} fmt={v => v + 'px'} onChange={v => u({ liftDepth: v })} />
          )}

          {(active === 'hollow' || active === 'border') && (<>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span className="label" style={{ marginBottom: 0 }}>{T('color')}</span>
              <ColorPicker value={sel.stroke ?? '#14160F'} onChange={c => u({ stroke: c })} brandColors={brandColors} />
            </div>
            <FxSlider label={T('thickness')} value={sel.strokeWidth ?? 2} min={1} max={20} step={1} fmt={v => v + 'px'} onChange={v => u({ strokeWidth: v })} />
          </>)}

          {active === 'echo' && (<>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span className="label" style={{ marginBottom: 0 }}>{T('color')}</span>
              <ColorPicker value={sel.echoColor ?? '#B9A3FF'} onChange={c => u({ echoColor: c })} brandColors={brandColors} />
            </div>
            <FxSlider label={T('countLabel')} value={sel.echoCount ?? 3} min={1} max={5} step={1} fmt={v => String(v)} onChange={v => u({ echoCount: v })} />
            <FxSlider label={T('offsetLabel')} value={sel.echoOffset ?? 8} min={1} max={30} step={1} fmt={v => v + 'px'} onChange={v => u({ echoOffset: v })} />
          </>)}

          {(active === 'glow' || active === 'neon') && (<>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span className="label" style={{ marginBottom: 0 }}>{T('color')}</span>
              <ColorPicker value={sel.glowColor ?? '#FFD34E'} onChange={c => u({ glowColor: c })} brandColors={brandColors} />
            </div>
            <FxSlider label={T('intensity')} value={sel.glowIntensity ?? 70} min={0} max={100} step={1} fmt={v => v + '%'} onChange={v => u({ glowIntensity: v })} />
            <FxSlider label={T('sizeLabel')} value={sel.glowSize ?? 14} min={1} max={40} step={1} fmt={v => v + 'px'} onChange={v => u({ glowSize: v })} />
          </>)}

          {active === 'background' && (<>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span className="label" style={{ marginBottom: 0 }}>{T('color')}</span>
              <ColorPicker value={sel.highlightColor ?? '#FFE45C'} onChange={c => u({ highlightColor: c })} brandColors={brandColors} />
            </div>
            <FxSlider label={T('opacity')} value={sel.highlightOpacity ?? 100} min={0} max={100} step={1} fmt={v => v + '%'} onChange={v => u({ highlightOpacity: v })} />
            <FxSlider label={T('rounding')} value={sel.highlightBorderRadius ?? 4} min={0} max={20} step={1} fmt={v => v + 'px'} onChange={v => u({ highlightBorderRadius: v })} />
            <FxSlider label={T('thickness')} value={sel.highlightPadding ?? 8} min={0} max={20} step={1} fmt={v => v + 'px'} onChange={v => u({ highlightPadding: v })} />
          </>)}
        </div>
      )}

      {active !== 'none' && (
        <button className="btn btn-dark" onClick={() => u({ ...FX_CLEAR })}
          style={{ width: '100%', marginTop: 18, justifyContent: 'center' }}>
          Retirer l&apos;effet
        </button>
      )}
    </div>
  );
}

// ─── Position (panneau gauche : organiser + aligner + avancé) ──────────────────

// Aperçu miniature d'un calque pour l'onglet « Calques » (façon Canva).
function LayerThumb({ el }: { el: CanvasEl }) {
  if (el.type === 'text') {
    return (
      <span style={{ maxWidth: '90%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: el.fontFamily, fontWeight: 700, fontSize: 13, color: el.fill || 'var(--ink)', textTransform: el.uppercase ? 'uppercase' : 'none' }}>
        {(el.text || 'Texte').trim() || 'Texte'}
      </span>
    );
  }
  if (el.type === 'image') {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={el.src} alt="" style={{ height: 34, maxWidth: '90%', objectFit: 'contain', borderRadius: 4 }} />;
  }
  if (el.type === 'vector' && el.imageSrc) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={el.imageSrc} alt="" style={{ height: 34, maxWidth: '90%', objectFit: 'contain', borderRadius: 4 }} />;
  }
  const fill = (el as { fill?: string }).fill || 'var(--ink-3)';
  const round = el.type === 'circle' ? '50%' : el.type === 'vector' && el.shape === 'pill' ? 999 : 6;
  return <span style={{ display: 'block', width: 40, height: 26, background: fill, borderRadius: round }} />;
}

// Liste de calques visuelle (miniatures + drag-to-reorder) façon Canva — partagée
// entre l'onglet Position › Calques et l'onglet Calques de la barre d'outils.
function RailLayerList({ elements, selectedId, hiddenIds, lockedIds, onSelect, onReorder, onToggleHidden, onToggleLocked }: {
  elements: CanvasEl[]; selectedId: string | null; hiddenIds: Set<string>; lockedIds: Set<string>;
  onSelect: (id: string) => void; onReorder: (frontToBackIds: string[]) => void;
  onToggleHidden: (id: string) => void; onToggleLocked: (id: string) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const order = [...elements].reverse(); // avant → arrière (haut de la liste = premier plan)
  const drop = (targetId: string) => {
    if (!dragId || dragId === targetId) { setDragId(null); setOverId(null); return; }
    const ids = order.map(o => o.id);
    const from = ids.indexOf(dragId), to = ids.indexOf(targetId);
    if (from < 0 || to < 0) { setDragId(null); setOverId(null); return; }
    const next = [...ids]; next.splice(from, 1); next.splice(to, 0, dragId);
    onReorder(next);
    setDragId(null); setOverId(null);
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {order.map((el) => {
        const isSel = el.id === selectedId;
        const isOver = el.id === overId && dragId !== el.id;
        const isHidden = hiddenIds.has(el.id);
        const isLocked = lockedIds.has(el.id);
        return (
          <div key={el.id} draggable={!isLocked}
            onDragStart={() => setDragId(el.id)}
            onDragOver={e => { e.preventDefault(); if (overId !== el.id) setOverId(el.id); }}
            onDragEnd={() => { setDragId(null); setOverId(null); }}
            onDrop={e => { e.preventDefault(); drop(el.id); }}
            onClick={() => { if (!isLocked) onSelect(el.id); }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px 4px 6px', height: 56, borderRadius: 10, cursor: isLocked ? 'default' : 'pointer', background: isSel ? 'var(--mint-soft)' : 'var(--sunk)', boxShadow: isSel ? 'inset 0 0 0 2px var(--mint-2)' : isOver ? 'inset 0 0 0 2px var(--ink-3)' : 'none', opacity: dragId === el.id ? .4 : isHidden ? .5 : 1, transition: 'box-shadow .12s' }}>
            <span style={{ flexShrink: 0, color: 'var(--ink-3)', cursor: isLocked ? 'default' : 'grab', display: 'grid' }} title="Glisser pour réordonner">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>
            </span>
            <div style={{ flex: 1, minWidth: 0, height: '100%', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
              <LayerThumb el={el} />
            </div>
            <button title={isHidden ? 'Afficher' : 'Masquer'} onClick={e => { e.stopPropagation(); onToggleHidden(el.id); }}
              style={{ width: 26, height: 26, borderRadius: 6, display: 'grid', placeItems: 'center', border: 'none', cursor: 'pointer', background: 'transparent', color: isHidden ? 'var(--ink-3)' : 'var(--ink-2)', flexShrink: 0 }}
              onMouseEnter={e => (e.currentTarget.style.background = 'color-mix(in srgb, var(--ink) 8%, transparent)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              {isHidden
                ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
            </button>
            <button title={isLocked ? 'Déverrouiller' : 'Verrouiller'} onClick={e => { e.stopPropagation(); onToggleLocked(el.id); }}
              style={{ width: 26, height: 26, borderRadius: 6, display: 'grid', placeItems: 'center', border: 'none', cursor: 'pointer', background: 'transparent', color: isLocked ? 'var(--ink-3)' : 'var(--mint-2)', flexShrink: 0 }}
              onMouseEnter={e => (e.currentTarget.style.background = 'color-mix(in srgb, var(--ink) 8%, transparent)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              {isLocked
                ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>}
            </button>
          </div>
        );
      })}
      {order.length === 0 && (
        <div style={{ padding: '24px 8px', textAlign: 'center', fontSize: 12.5, color: 'var(--ink-3)' }}>Aucun calque pour le moment.</div>
      )}
    </div>
  );
}

function PositionPanel({ sel, stageW, stageH, elements, selectedId, onUpdate, onAlign, onLayerAction, onSelect, onReorderLayers, onClose }: { sel: CanvasEl; stageW: number; stageH: number; elements: CanvasEl[]; selectedId: string | null; onUpdate: (patch: Partial<CanvasEl>) => void; onAlign: (dir: string) => void; onLayerAction: (a: 'front' | 'forward' | 'backward' | 'back') => void; onSelect: (id: string) => void; onReorderLayers: (frontToBackIds: string[]) => void; onClose: () => void }) {
  const T = useTranslations('editor');
  const u = (patch: Partial<CanvasEl>) => onUpdate(patch);
  const [tab, setTab] = useState<'organiser' | 'calques'>('organiser');
  const [lock, setLock] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  // Dimensions (largeur/hauteur) dérivées selon le type d'élément.
  const w = 'width' in sel ? (sel as { width: number }).width
    : sel.type === 'circle' ? (sel as CircleEl).radius * 2
    : sel.type === 'star' ? (sel as StarEl).outerRadius * 2 : undefined;
  const h = 'height' in sel ? (sel as { height: number }).height
    : sel.type === 'circle' ? (sel as CircleEl).radius * 2
    : sel.type === 'star' ? (sel as StarEl).outerRadius * 2 : undefined;
  const setW = (v: number) => {
    v = Math.max(4, v);
    if (sel.type === 'circle') return u({ radius: v / 2 } as Partial<CanvasEl>);
    if (sel.type === 'star') return u({ outerRadius: v / 2, innerRadius: v / 2 * ((sel as StarEl).innerRadius / (sel as StarEl).outerRadius) } as Partial<CanvasEl>);
    if (lock && w && h) return u({ width: v, height: Math.round(v * h / w) } as Partial<CanvasEl>);
    return u({ width: v } as Partial<CanvasEl>);
  };
  const setH = (v: number) => {
    v = Math.max(4, v);
    if (sel.type === 'circle') return u({ radius: v / 2 } as Partial<CanvasEl>);
    if (sel.type === 'star') return u({ outerRadius: v / 2, innerRadius: v / 2 * ((sel as StarEl).innerRadius / (sel as StarEl).outerRadius) } as Partial<CanvasEl>);
    if (lock && w && h) return u({ height: v, width: Math.round(v * w / h) } as Partial<CanvasEl>);
    return u({ height: v } as Partial<CanvasEl>);
  };

  const Field = ({ label, value, unit, disabled, onChange }: { label: string; value?: number; unit?: string; disabled?: boolean; onChange?: (v: number) => void }) => (
    <div>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', marginBottom: 5 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 8, background: disabled ? 'var(--sunk)' : 'var(--white)', opacity: disabled ? .6 : 1 }}>
        <input type="number" disabled={disabled} value={value === undefined ? '' : Math.round(value)} onChange={e => onChange?.(parseFloat(e.target.value) || 0)}
          style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, fontWeight: 700, color: 'var(--ink)', fontFamily: 'var(--mono)' }} />
        {unit && <span style={{ fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 600 }}>{unit}</span>}
      </div>
    </div>
  );

  const order = [...elements].reverse(); // avant → arrière (haut de la liste = premier plan)
  const drop = (targetId: string) => {
    if (!dragId || dragId === targetId) { setDragId(null); setOverId(null); return; }
    const ids = order.map(o => o.id);
    const from = ids.indexOf(dragId), to = ids.indexOf(targetId);
    if (from < 0 || to < 0) { setDragId(null); setOverId(null); return; }
    const next = [...ids]; next.splice(from, 1); next.splice(to, 0, dragId);
    onReorderLayers(next);
    setDragId(null); setOverId(null);
  };

  return (
    <div style={{ padding: 18, display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
        <h3 className="h-title" style={{ fontSize: 18 }}>Position</h3>
        <button onClick={onClose} title={T('close')}
          style={{ marginLeft: 'auto', width: 30, height: 30, borderRadius: 8, display: 'grid', placeItems: 'center', color: 'var(--ink-3)', background: 'transparent', border: 'none', cursor: 'pointer' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--sunk)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </div>

      {/* Onglets Organiser | Calques */}
      <div style={{ display: 'flex', marginBottom: 18, position: 'relative' }}>
        {([['organiser', 'Organiser'], ['calques', 'Calques']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ flex: 1, padding: '9px 0 11px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14, fontWeight: tab === id ? 800 : 600, color: tab === id ? 'var(--ink)' : 'var(--ink-3)', borderBottom: tab === id ? '2.5px solid var(--mint-2)' : '2.5px solid var(--line)', transition: 'color .15s' }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'organiser' ? (
        <>
          <div className="label" style={{ marginBottom: 8 }}>Organiser</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 18 }}>
            {([
              ['forward', 'Avant', <svg key="a" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l7 4-7 4-7-4 7-4z"/><path d="M5 12l7 4 7-4"/></svg>],
              ['backward', 'Arrière', <svg key="b" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 13l7 4-7 4-7-4 7-4z"/><path d="M5 8l7 4 7-4"/></svg>],
              ['front', 'Avant-plan', <svg key="c" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="3" width="9" height="9" rx="1.5" fill="currentColor" fillOpacity=".16"/><path d="M13 16H5a1 1 0 0 1-1-1V8"/></svg>],
              ['back', 'Arrière-plan', <svg key="d" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="9" width="9" height="9" rx="1.5" fill="currentColor" fillOpacity=".16"/><path d="M9 5h8a1 1 0 0 1 1 1v8"/></svg>],
            ] as const).map(([id, label, icon]) => (
              <button key={id} onClick={() => onLayerAction(id)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 13px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--white)', cursor: 'pointer', fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', textAlign: 'left' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--sunk)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--white)')}>
                {icon}<span>{label}</span>
              </button>
            ))}
          </div>

          <div className="label" style={{ marginBottom: 8 }}>{T('alignToPage')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 18 }}>
            {([
              ['top', 'Haut', <svg key="1" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 4h16"/><rect x="9" y="8" width="6" height="12" rx="1"/></svg>],
              ['left', 'Gauche', <svg key="2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 4v16"/><rect x="8" y="9" width="12" height="6" rx="1"/></svg>],
              ['center-v', 'Centre', <svg key="3" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 12h16"/><rect x="9" y="6" width="6" height="12" rx="1"/></svg>],
              ['center-h', 'Centre', <svg key="4" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 4v16"/><rect x="6" y="9" width="12" height="6" rx="1"/></svg>],
              ['bottom', 'Bas', <svg key="5" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 20h16"/><rect x="9" y="4" width="6" height="12" rx="1"/></svg>],
              ['right', 'Droite', <svg key="6" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M20 4v16"/><rect x="4" y="9" width="12" height="6" rx="1"/></svg>],
            ] as const).map(([id, label, icon]) => (
              <button key={id} onClick={() => onAlign(id)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 13px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--white)', cursor: 'pointer', fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', textAlign: 'left' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--sunk)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--white)')}>
                {icon}<span>{label}</span>
              </button>
            ))}
          </div>

          <div className="label" style={{ marginBottom: 8 }}>Avancé</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
            {Field({ label: 'Largeur', value: w, unit: 'px', onChange: setW })}
            {Field({ label: 'Hauteur', value: h, unit: 'px', disabled: sel.type === 'text', onChange: setH })}
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', marginBottom: 5 }}>Ratio</div>
              <button onClick={() => setLock(l => !l)} title={lock ? 'Ratio verrouillé' : 'Verrouiller le ratio'}
                style={{ width: '100%', height: 37, display: 'grid', placeItems: 'center', border: '1px solid var(--line)', borderRadius: 8, cursor: 'pointer', background: lock ? 'var(--mint-soft)' : 'var(--white)', color: lock ? 'var(--mint-2)' : 'var(--ink-2)' }}>
                {lock
                  ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
                  : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.9-1"/></svg>}
              </button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {Field({ label: 'X', value: sel.x, unit: 'px', onChange: v => u({ x: v }) })}
            {Field({ label: 'Y', value: sel.y, unit: 'px', onChange: v => u({ y: v }) })}
            {Field({ label: 'Pivoter', value: sel.rotation, unit: '°', onChange: v => u({ rotation: v }) })}
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {order.map((el) => {
            const isSel = el.id === selectedId;
            const isOver = el.id === overId && dragId !== el.id;
            return (
              <div key={el.id} draggable
                onDragStart={() => setDragId(el.id)}
                onDragOver={e => { e.preventDefault(); if (overId !== el.id) setOverId(el.id); }}
                onDragEnd={() => { setDragId(null); setOverId(null); }}
                onDrop={e => { e.preventDefault(); drop(el.id); }}
                onClick={() => onSelect(el.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px 4px 6px', height: 56, borderRadius: 10, cursor: 'pointer', background: isSel ? 'var(--mint-soft)' : 'var(--sunk)', boxShadow: isSel ? 'inset 0 0 0 2px var(--mint-2)' : isOver ? 'inset 0 0 0 2px var(--ink-3)' : 'none', opacity: dragId === el.id ? .4 : 1, transition: 'box-shadow .12s' }}>
                <span style={{ flexShrink: 0, color: 'var(--ink-3)', cursor: 'grab', display: 'grid' }} title="Glisser pour réordonner">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>
                </span>
                <div style={{ flex: 1, minWidth: 0, height: '100%', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
                  <LayerThumb el={el} />
                </div>
              </div>
            );
          })}
          {order.length === 0 && (
            <div style={{ padding: '24px 8px', textAlign: 'center', fontSize: 12.5, color: 'var(--ink-3)' }}>Aucun calque pour le moment.</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

// ─── Écran de composition IA ─────────────────────────────────────────────────
// Plein cadre (position fixed) : la barre d'outils de l'éditeur restait visible
// par-dessus l'ancien calque, qui n'était qu'absolu dans la zone de travail.
// Parti pris : au lieu d'un dégradé + logo, on MONTRE la composition en train de
// se faire — une maquette miniature où les blocs se posent un par un. Les motifs
// viennent tous de la landing : fond crème, cadre de sélection « fourmis » violet,
// curseur collaboratif étiqueté, cartes flottantes leaf/forest, étoiles.
const GEN_STEPS: {
  key: string;
  label: string;
  box: React.CSSProperties;   // bloc posé dans la maquette
  cursor: { x: string; y: string };
}[] = [
  { key: 'photo', label: 'On lit votre photo',
    box: { left: 8, top: 8, right: 8, bottom: 8, borderRadius: 9, background: 'linear-gradient(150deg,#2A4A38,#16301F 60%,#0F2418)' },
    cursor: { x: '52%', y: '34%' } },
  { key: 'scrim', label: 'La charte du client s’applique',
    box: { left: 8, right: 8, bottom: 8, height: 104, borderRadius: 9, background: 'linear-gradient(180deg,rgba(7,33,23,0),rgba(7,33,23,.86))' },
    cursor: { x: '62%', y: '62%' } },
  { key: 'title', label: 'Le titre trouve sa place',
    box: { left: 18, bottom: 62, width: 122, height: 24, borderRadius: 4, background: '#F1F0E5' },
    cursor: { x: '30%', y: '73%' } },
  { key: 'sub', label: 'Textes et marges recalés, rien ne déborde',
    box: { left: 18, bottom: 44, width: 88, height: 10, borderRadius: 3, background: 'rgba(241,240,229,.5)' },
    cursor: { x: '24%', y: '82%' } },
  { key: 'cta', label: 'Les couleurs de la marque arrivent',
    box: { left: 18, bottom: 18, width: 66, height: 20, borderRadius: 999, background: '#BDF2A0' },
    cursor: { x: '20%', y: '90%' } },
];

function AiGeneratingOverlay({ title, detail, lines }: { title: string; detail?: string; lines?: string[] }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    // Boucle : on rejoue la composition tant que l'IA travaille.
    const id = setInterval(() => setStep(s => (s + 1) % (GEN_STEPS.length + 2)), 1250);
    return () => clearInterval(id);
  }, []);

  const active = Math.min(step, GEN_STEPS.length - 1);
  const cur = GEN_STEPS[active].cursor;

  return (
    <div className="klipgen" role="status" aria-live="polite">
      <div className="klipgen-stage">
        {/* Étoiles de la charte, posées autour de la scène */}
        <svg className="klipgen-star klipgen-s1 floatA" width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 0L14 10L24 12L14 14L12 24L10 14L0 12L10 10Z" fill="#BDF2A0" /></svg>
        <svg className="klipgen-star klipgen-s2 floatB" width="17" height="17" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 0L14 10L24 12L14 14L12 24L10 14L0 12L10 10Z" fill="#6656D9" /></svg>

        {/* Cartes flottantes — mêmes pastilles que la landing */}
        <span className="klipgen-card klipgen-card-leaf floatA">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3Z"/></svg>
          Votre charte
        </span>
        <span className="klipgen-card klipgen-card-forest floatB">Voix du client</span>

        {/* Maquette miniature : les blocs se posent un par un */}
        <div className="klipgen-canvas">
          {GEN_STEPS.map((b, i) => (
            <span
              key={b.key}
              className={`klipgen-block${i <= active && step < GEN_STEPS.length + 2 ? ' in' : ''}`}
              style={b.box}
            />
          ))}
          {/* Cadre de sélection « fourmis » sur le bloc en cours de pose.
              Seule la géométrie est reprise : passer tout le style repeindrait
              aussi le fond du bloc par-dessus la maquette. */}
          <div className="klipgen-ants" aria-hidden="true" style={{
            left: GEN_STEPS[active].box.left, top: GEN_STEPS[active].box.top,
            right: GEN_STEPS[active].box.right, bottom: GEN_STEPS[active].box.bottom,
            width: GEN_STEPS[active].box.width, height: GEN_STEPS[active].box.height,
          }}>
            {/* Le SVG est un élément remplacé : posé directement en absolu avec
                left+right il garderait sa largeur intrinsèque (300px) au lieu de
                s'étirer. D'où ce conteneur qui porte la géométrie. */}
            <svg><rect x="1" y="1" rx="4" /></svg>
          </div>

          {/* Curseur collaboratif qui vient poser chaque bloc. Placé DANS la
              maquette : ses coordonnées sont en % du cadre, pas de la scène. */}
          <div className="klipgen-cur" style={{ left: cur.x, top: cur.y }} aria-hidden="true">
            <svg width="19" height="19" viewBox="0 0 24 24"><path d="M3.5 2.2 L11 20.5 L13.6 12.6 L21.5 10 Z" fill="#6656D9" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round"/></svg>
            <span className="klipgen-cur-tag">Klip</span>
          </div>
        </div>
      </div>

      <div className="klipgen-copy">
        <h2>{title}</h2>
        <p className="klipgen-step">{detail || GEN_STEPS[active].label}</p>
        <div className="klipgen-dots" aria-hidden="true">
          {GEN_STEPS.map((b, i) => (
            <span key={b.key} className={i <= active ? 'on' : ''} />
          ))}
        </div>
        {lines && lines.length > 0 && (
          <div style={{ width: 'min(420px, 86vw)', margin: '10px auto 0', textAlign: 'left' }}>
            <AiThinkingLog lines={lines} />
          </div>
        )}
        <p className="klipgen-reassure">Quelques secondes, et le visuel est prêt à retoucher.</p>
      </div>

      <style>{`
        .klipgen {
          position: fixed; inset: 0; z-index: 5000;
          background: #F1F0E5;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 34px; cursor: wait; overflow: hidden;
          font-family: var(--sans), system-ui, sans-serif;
          /* Trame de points : la texture de fond de la landing */
          background-image: radial-gradient(rgba(12,42,29,.07) 1px, transparent 1px);
          background-size: 22px 22px;
        }
        .klipgen-stage { position: relative; width: 300px; height: 262px; display: grid; place-items: center; }

        .klipgen-canvas {
          position: relative; width: 176px; height: 220px;
          background: #FBFAF4; border-radius: 13px;
          box-shadow: 0 0 0 1px rgba(12,42,29,.10), 0 26px 50px -22px rgba(16,19,11,.45);
        }
        .klipgen-block {
          position: absolute; display: block;
          opacity: 0; transform: translateY(7px) scale(.97);
          transition: opacity .34s ease, transform .34s cubic-bezier(.2,.8,.3,1);
        }
        .klipgen-block.in { opacity: 1; transform: none; }

        .klipgen-ants {
          position: absolute; pointer-events: none;
          transition: all .34s cubic-bezier(.2,.8,.3,1);
        }
        .klipgen-ants svg { width: 100%; height: 100%; display: block; overflow: visible; }
        .klipgen-ants rect {
          width: calc(100% - 2px); height: calc(100% - 2px);
          fill: none; stroke: #6656D9; stroke-width: 2; stroke-dasharray: 8 7;
          animation: klipgen-ants 1.2s linear infinite;
        }
        @keyframes klipgen-ants { to { stroke-dashoffset: -15; } }

        .klipgen-cur {
          position: absolute; z-index: 8; display: flex; flex-direction: column; align-items: flex-start; gap: 2px;
          pointer-events: none; filter: drop-shadow(0 6px 14px rgba(16,19,11,.25));
          transition: left .42s cubic-bezier(.3,.7,.3,1), top .42s cubic-bezier(.3,.7,.3,1);
        }
        .klipgen-cur-tag {
          font-weight: 800; font-size: 11px; color: #fff; background: #6656D9;
          padding: 3px 9px; border-radius: 999px 999px 999px 4px; margin-left: 13px; white-space: nowrap;
        }

        .klipgen-card {
          position: absolute; z-index: 7; display: inline-flex; align-items: center; gap: 7px;
          border-radius: 12px; padding: 9px 13px; font-weight: 800; font-size: 12.5px;
          box-shadow: 0 18px 36px -18px rgba(16,19,11,.45);
        }
        .klipgen-card-leaf   { background: #BDF2A0; color: #1E3317; top: 2px;  left: -78px;  --r: -7deg; }
        .klipgen-card-forest { background: #0C2A1D; color: #EEEDE3; bottom: 8px; right: -72px; --r: 6deg; }

        .klipgen-star { position: absolute; z-index: 6; }
        .klipgen-s1 { top: -6px; right: 6px; --r: 0deg; }
        .klipgen-s2 { bottom: 44px; left: -6px; --r: 0deg; }

        .floatA { animation: klipgen-floatA 7s ease-in-out infinite; }
        .floatB { animation: klipgen-floatB 6s ease-in-out infinite; }
        @keyframes klipgen-floatA { 0%,100% { transform: translateY(0) rotate(var(--r,0deg)); } 50% { transform: translateY(-13px) rotate(calc(var(--r,0deg) + 3deg)); } }
        @keyframes klipgen-floatB { 0%,100% { transform: translateY(0) rotate(var(--r,0deg)); } 50% { transform: translateY(-9px) rotate(calc(var(--r,0deg) - 3deg)); } }

        .klipgen-copy { position: relative; text-align: center; max-width: 430px; padding: 0 24px; }
        .klipgen-copy h2 {
          margin: 0; font-family: var(--display), system-ui, sans-serif; font-weight: 800;
          font-size: 25px; line-height: 1.2; letter-spacing: -0.02em; color: #14160F; text-wrap: balance;
        }
        .klipgen-step { margin: 9px 0 0; font-size: 13.5px; line-height: 1.5; color: #5A5E50; min-height: 20px; }
        .klipgen-dots { display: flex; gap: 6px; justify-content: center; margin-top: 18px; }
        .klipgen-dots span {
          width: 6px; height: 6px; border-radius: 50%; background: rgba(12,42,29,.16);
          transition: background .3s ease, transform .3s ease;
        }
        .klipgen-dots span.on { background: #6656D9; transform: scale(1.25); }
        .klipgen-reassure { margin: 16px 0 0; font-size: 12.5px; color: #8B8E7F; }

        @media (prefers-reduced-motion: reduce) {
          .klipgen-ants rect, .floatA, .floatB { animation: none !important; }
          .klipgen-block, .klipgen-ants, .klipgen-cur { transition: none !important; }
        }
      `}</style>
    </div>
  );
}
export function VisualEditor({ workspaceId, postId, templateId, mode }: { workspaceId: string; postId?: string; templateId?: string; mode: 'post' | 'template' }) {
  const T = useTranslations('editor');
  const isTemplate = mode === 'template';
  const entityId = postId ?? templateId ?? 'new';

  const supabase = createClientComponentClient();
  const stageRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isKonvaDragging, setIsKonvaDragging] = useState(false);

  // ── Sidebar collapse (persisted in localStorage) ──────────────────────────
  const [sidebarOpen, setSidebarOpen] = useState(true);
  useEffect(() => {
    setSidebarOpen(localStorage.getItem('editorSidebarOpen') !== 'false');
  }, []);
  function toggleSidebar() {
    setSidebarOpen(prev => {
      const next = !prev;
      localStorage.setItem('editorSidebarOpen', String(next));
      return next;
    });
  }
  const [cropId, setCropId] = useState<string | null>(null);
  const [maskCropId, setMaskCropId] = useState<string | null>(null);
  const [bgRemovingId, setBgRemovingId] = useState<string | null>(null);
  const maskPhotoInputRef = useRef<HTMLInputElement>(null);

  const [proxyUrl, setProxyUrl] = useState<string>('');
  const [bgStyle, setBgStyle] = useState<BgStyle | null>(null);
  const [postTemplateId, setPostTemplateId] = useState<string | null>(null);
  const [bgOffsetX, setBgOffsetX] = useState(0);
  const [bgOffsetY, setBgOffsetY] = useState(0);
  const [bgCropMode, setBgCropMode] = useState(false);
  const bgOffsetXRef = useRef(0);
  const bgOffsetYRef = useRef(0);
  useEffect(() => { bgOffsetXRef.current = bgOffsetX; }, [bgOffsetX]);
  useEffect(() => { bgOffsetYRef.current = bgOffsetY; }, [bgOffsetY]);
  const [formatId, setFormatId] = useState('ig-portrait');
  // Renseigné quand le visuel est rouvert dans un format différent de celui où il a
  // été dessiné : sert à afficher le bandeau « vérifie l'adaptation ».
  const [formatChangedFrom, setFormatChangedFrom] = useState<{ from: string; to: string } | null>(null);
  const [postType, setPostType] = useState<'post' | 'reel' | 'story' | 'carrousel'>('post');
  const [editorToast, setEditorToast] = useState<string | null>(null);
  const [showStoryWarn, setShowStoryWarn] = useState(false);
  const [pendingStoryType, setPendingStoryType] = useState<'post' | 'reel' | 'story' | 'carrousel' | null>(null);
  // Carrousel continu (panorama à volets liés) : une seule grande toile éditable de
  // largeur stageW*volets ; les éléments peuvent chevaucher les limites de volets et
  // sont découpés à l'export en slides Instagram séparées.
  const [carouselContinuous, setCarouselContinuous] = useState(false);
  const [contPanels, setContPanels] = useState(2);
  const activeFormat = FORMATS.find(f => f.id === formatId) ?? FORMATS[0];
  const stageW = activeFormat.w;
  const stageH = activeFormat.h;
  // Le carrousel n'est plus un type de post : toute publication (sauf story, qui se
  // publie image par image) devient un carrousel dès qu'elle a plusieurs pages.
  const canBeCarousel = postType !== 'story' && postType !== 'reel';
  const isContinuous = canBeCarousel && carouselContinuous;
  const stageWView = isContinuous ? stageW * contPanels : stageW;
  const [elements, setElements] = useState<CanvasEl[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  // Portion de texte sélectionnée à l'intérieur du bloc en cours d'édition.
  // Non nulle et non vide ⇒ les réglages typographiques de la barre d'outils
  // ne s'appliquent qu'à cette portion.
  const [textRange, setTextRange] = useState<{ start: number; end: number } | null>(null);
  const richRef = useRef<RichTextHandle | null>(null);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [lockedIds, setLockedIds] = useState<Set<string>>(new Set());
  const [guides, setGuides] = useState<{ v: number | null; h: number | null }>({ v: null, h: null });
  const [showGrid, setShowGrid] = useState(false);
  const [extendCount, setExtendCount] = useState(1);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Historique GLOBAL au visuel, pas par plan de travail.
  //
  // Il était remis à zéro à chaque changement de page : on modifiait la page 1,
  // on allait voir la page 2, et en revenant Cmd+Z ne pouvait plus rien annuler —
  // le travail précédent était sorti de l'historique. Chaque entrée retient donc
  // la page à laquelle elle appartient, et annuler y ramène automatiquement.
  type HistEntry = { slide: number; els: CanvasEl[] };
  const historyRef = useRef<HistEntry[]>([{ slide: 0, els: [] }]);
  const histIdxRef = useRef(0);
  const [histTick, setHistTick] = useState(0);
  // Index de page lisible de façon SYNCHRONE : `activeSlideIdx` est un état, donc
  // périmé dans une closure différée (l'auto-save attend 1,5 s) — et sauvegarder
  // dans la mauvaise page écraserait le travail d'une autre.
  const activeSlideIdxRef = useRef(0);

  const [showUnsplash, setShowUnsplash] = useState(false);
  const [unsplashQuery, setUnsplashQuery] = useState('');
  const [unsplashPhotos, setUnsplashPhotos] = useState<string[]>([]);
  const [unsplashLoading, setUnsplashLoading] = useState(false);

  interface PexelsPhoto { id: number; src: { medium: string; large: string }; photographer: string; alt: string; }
  const [pexelsQuery, setPexelsQuery] = useState('');
  const [pexelsPhotos, setPexelsPhotos] = useState<PexelsPhoto[]>([]);
  const [pexelsPage, setPexelsPage] = useState(1);
  const [pexelsTotalPages, setPexelsTotalPages] = useState(0);
  const [pexelsLoading, setPexelsLoading] = useState(false);

  // Icônes SVG (Iconify) + couleur d'ajout
  const [iconQuery, setIconQuery] = useState('');
  const [iconResults, setIconResults] = useState<string[]>([]);
  const [iconLoading, setIconLoading] = useState(false);
  const [iconColor, setIconColor] = useState('#14160F');
  const [stickerColor, setStickerColor] = useState('#2FD79B');
  const [stickerCat, setStickerCat] = useState<string>('Tous');
  const [stickerLibOpen, setStickerLibOpen] = useState(false);
  const [stickerLibQuery, setStickerLibQuery] = useState('');
  const [stickerLibPhotos, setStickerLibPhotos] = useState<{ id: number; thumb: string; full: string; alt: string }[]>([]);
  const [stickerLibPhotoLoading, setStickerLibPhotoLoading] = useState(false);

  const elementsRef = useRef<CanvasEl[]>([]);
  const selectedIdRef = useRef<string | null>(null);
  const selectedIdsRef = useRef<string[]>([]);
  const editingIdRef = useRef<string | null>(null);
  useEffect(() => { elementsRef.current = elements; }, [elements]);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);
  useEffect(() => { editingIdRef.current = editingId; if (!editingId) setTextRange(null); }, [editingId]);

  // Les polices de charte arrivent après le premier rendu. Tant qu'elles ne sont
  // pas là, on mesure une police de repli et les blocs sont mal dimensionnés :
  // on vide le cache de mesure et on redessine dès que le chargement est fini.
  const [, setFontTick] = useState(0);
  useEffect(() => {
    if (typeof document === 'undefined' || !document.fonts) return;
    let alive = true;
    /* Konva garde SA PROPRE mesure du texte, et c'est elle qui centre les lignes.

       Vider notre cache et redessiner ne la touche pas : react-konva n'appelle
       un setter que si la valeur a changé, donc un nœud mesuré avant l'arrivée
       de la police garde sa largeur de repli. Un titre centré était alors
       dessiné trop à gauche — d'environ (largeur de repli - largeur réelle) / 2,
       soit une quarantaine de pixels en Oswald — pendant que son aplat, lui,
       se calait sur la vraie mesure. D'où l'« effet buggé » du template neuf :
       le bloc de couleur et le texte ne se superposaient plus.

       On force donc chaque nœud texte à se re-mesurer, par l'API publique :
       une valeur différente puis la bonne, ce qui déclenche le recalcul. */
    const remesurerKonva = () => {
      try {
        const noeuds = stageRef.current?.find?.('Text') ?? [];
        for (const n of noeuds) {
          const f = n.fontFamily();
          n.fontFamily('klip-remesure');
          n.fontFamily(f);
        }
        stageRef.current?.batchDraw?.();
      } catch { /* pas de scène montée : rien à re-mesurer */ }
    };
    const bump = () => { if (alive) { clearTextMetricsCache(); remesurerKonva(); setFontTick(t => t + 1); } };
    document.fonts.ready.then(bump).catch(() => {});
    document.fonts.addEventListener?.('loadingdone', bump);
    return () => { alive = false; document.fonts.removeEventListener?.('loadingdone', bump); };
  }, []);
  useEffect(() => { selectedIdsRef.current = selectedIds; }, [selectedIds]);
  useEffect(() => { if (selectedId) { setBgCropMode(false); setBgImageSelected(false); setMaskCropId(null); } }, [selectedId]);

  // ── Multi-selection helpers ────────────────────────────────────────────────
  const multiDragStartRef = useRef<Record<string, { x: number; y: number }>>({});
  // Alt maintenu (suivi global) et Alt armé au début du glissement en cours.
  const altDownRef = useRef(false);
  const altDragRef = useRef(false);
  // Aperçu de la copie pendant un Alt+glisser. La duplication n'aboutit qu'au
  // relâchement : sans cet aperçu, on déplaçait « à l'aveugle », rien ne
  // montrait qu'une copie était en train d'être créée.
  // Ce sont des calques d'affichage seulement, jamais poussés dans l'état des
  // éléments : toucher `elements` pendant le glissement replacerait le nœud
  // tiré sur ses coordonnées d'état, sous le curseur.
  const [altGhosts, setAltGhosts] = useState<CanvasEl[] | null>(null);
  const GHOST_PREFIX = 'ghost-';

  const handleElClick = (id: string, shiftKey: boolean) => {
    if (lockedIds.has(id)) return;
    if (shiftKey) {
      setSelectedIds(prev => {
        if (prev.includes(id)) {
          const next = prev.filter(x => x !== id);
          setSelectedId(next.at(-1) ?? null);
          return next;
        } else {
          setSelectedId(id);
          return [...prev, id];
        }
      });
    } else {
      setSelectedId(id);
      setSelectedIds([id]);
    }
  };

  const handleElDragStart = (id: string) => {
    setIsKonvaDragging(true);
    // On note la position de départ de TOUT ce qui bouge (même un seul calque) :
    // c'est ce qui permet à Alt+glisser de laisser une copie sur place.
    const ids = selectedIdsRef.current.length > 1 ? selectedIdsRef.current : [id];
    const starts: Record<string, { x: number; y: number }> = {};
    for (const sid of ids) {
      const e = elementsRef.current.find(el => el.id === sid);
      if (e) starts[sid] = { x: e.x, y: e.y };
    }
    multiDragStartRef.current = starts;
    altDragRef.current = altDownRef.current;
    if (altDownRef.current) {
      setAltGhosts(
        elementsRef.current
          .filter(e => ids.includes(e.id))
          // Légèrement estompée : elle se lit comme une copie en cours, pas
          // comme un calque déjà posé.
          .map(e => ({ ...e, id: `${GHOST_PREFIX}${e.id}`, opacity: Math.round(e.opacity * 0.7) } as CanvasEl)),
      );
    }
  };

  const handleElDragEnd = (id: string, x: number, y: number) => {
    setIsKonvaDragging(false);
    setGuides({ v: null, h: null });
    setAltGhosts(null);
    const ids = selectedIdsRef.current;
    const starts = multiDragStartRef.current;
    // Alt+glisser = duplication, comme dans Canva et Figma : l'original reste
    // où il était, c'est une copie qu'on emporte. La copie est posée JUSTE SOUS
    // son modèle pour ne pas bousculer l'ordre des calques.
    const duplicate = altDragRef.current;
    altDragRef.current = false;

    let next: CanvasEl[];
    if (ids.length > 1 && starts[id]) {
      const dx = x - starts[id].x;
      const dy = y - starts[id].y;
      next = elementsRef.current.map(e => {
        if (!ids.includes(e.id)) return e;
        const s = starts[e.id];
        return s ? { ...e, x: s.x + dx, y: s.y + dy } : e;
      });
    } else {
      next = elementsRef.current.map(e => (e.id === id ? { ...e, x, y } : e));
    }

    if (duplicate) {
      const moved = ids.length > 1 ? ids : [id];
      next = next.flatMap(e => {
        const s = starts[e.id];
        if (!moved.includes(e.id) || !s) return [e];
        return [{ ...e, id: newId(), x: s.x, y: s.y } as CanvasEl, e];
      });
    }
    applyElements(next);
  };

  // ── Sélection par cadre (lasso) ───────────────────────────────────────────
  // Un cliquer-glisser sur une zone vide trace un rectangle et sélectionne tout
  // ce qu'il touche. En dessous du seuil de déplacement, on retombe sur le
  // comportement de simple clic (désélection / passage en recadrage du fond).
  const MARQUEE_THRESHOLD = 4;
  const marqueeStartRef = useRef<{ x: number; y: number } | null>(null);
  const [marquee, setMarqueeState] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const marqueeRectRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const setMarquee = (r: { x: number; y: number; w: number; h: number } | null) => {
    marqueeRectRef.current = r;
    setMarqueeState(r);
  };
  const [isDragOverCanvas, setIsDragOverCanvas] = useState(false);

  const beginMarquee = (stage: Konva.Stage | null) => {
    const p = stage?.getPointerPosition();
    if (!p) return;
    marqueeStartRef.current = { x: p.x, y: p.y };
    setMarquee(null);
  };

  const updateMarquee = (stage: Konva.Stage | null) => {
    const start = marqueeStartRef.current;
    if (!start) return;
    const p = stage?.getPointerPosition();
    if (!p) return;
    if (Math.abs(p.x - start.x) < MARQUEE_THRESHOLD && Math.abs(p.y - start.y) < MARQUEE_THRESHOLD) return;
    setMarquee({
      x: Math.min(start.x, p.x), y: Math.min(start.y, p.y),
      w: Math.abs(p.x - start.x), h: Math.abs(p.y - start.y),
    });
  };

  // Renvoie true si un cadre a été tracé (donc le mouseup n'est pas un simple clic).
  const endMarquee = (): boolean => {
    marqueeStartRef.current = null;
    const rect = marqueeRectRef.current;
    setMarquee(null);
    if (!rect) return false;
    const hits = elementsRef.current.filter(el => {
      if (hiddenIds.has(el.id) || lockedIds.has(el.id)) return false;
      const b = getElBox(el);
      return b.l < rect.x + rect.w && b.r > rect.x && b.t < rect.y + rect.h && b.b > rect.y;
    });
    setSelectedIds(hits.map(h => h.id));
    setSelectedId(hits.at(-1)?.id ?? null);
    return true;
  };

  // Filet de sécurité : relâchement hors du Stage (le curseur sort du canvas).
  useEffect(() => {
    if (!marquee) return;
    const onUp = () => { endMarquee(); };
    window.addEventListener('mouseup', onUp);
    return () => window.removeEventListener('mouseup', onUp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marquee]);

  // ── Carousel slides ───────────────────────────────────────────────────────
  const [slides, setSlides] = useState<Slide[]>([{ id: 'slide-1', elements: [], proxyUrl: '' }]);
  const [activeSlideIdx, setActiveSlideIdxState] = useState(0);
  // Toujours passer par ce setter : le ref doit suivre l'état sans attendre le
  // rendu suivant (cf. activeSlideIdxRef).
  const setActiveSlideIdx = useCallback((idx: number) => {
    activeSlideIdxRef.current = idx;
    setActiveSlideIdxState(idx);
  }, []);
  const slidesRef = useRef<Slide[]>(slides);
  const proxyUrlRef = useRef<string>('');
  useEffect(() => { slidesRef.current = slides; }, [slides]);
  useEffect(() => { proxyUrlRef.current = proxyUrl; }, [proxyUrl]);

  // ── Carousel: save current slide state into slidesRef ────────────────────
  const saveCurrentSlide = () => {
    // Aperçu net des slides inactives (0.3 rendait le plan de travail flou en carrousel).
    const thumbnail = stageRef.current?.toDataURL({ pixelRatio: 1.25 }) ?? undefined;
    // Index lu au ref : appelée depuis un timer (auto-save), la valeur d'état
    // serait celle d'AVANT le changement de page, et on écrirait le contenu
    // courant par-dessus une autre page.
    const cur = activeSlideIdxRef.current;
    const updated = slidesRef.current.map((s, i) =>
      i === cur ? {
        ...s,
        elements: elementsRef.current,
        proxyUrl: proxyUrlRef.current,
        bgOffsetX: bgOffsetXRef.current,
        bgOffsetY: bgOffsetYRef.current,
        thumbnail,
      } : s
    );
    slidesRef.current = updated;
    return updated;
  };

  // Bascule vers une page SANS toucher à l'historique : c'est ce qui permet à
  // Cmd+Z de remonter au-delà d'un changement de page (cf. historyRef).
  const goToSlide = (idx: number, slidesSource?: Slide[]) => {
    const list = slidesSource ?? slidesRef.current;
    const next = list[idx];
    if (!next) return;
    setElements(next.elements);
    elementsRef.current = next.elements;
    setProxyUrl(next.proxyUrl);
    proxyUrlRef.current = next.proxyUrl;
    setBgOffsetX(next.bgOffsetX ?? 0);
    bgOffsetXRef.current = next.bgOffsetX ?? 0;
    setBgOffsetY(next.bgOffsetY ?? 0);
    bgOffsetYRef.current = next.bgOffsetY ?? 0;
    setBgCropMode(false);
    setActiveSlideIdx(idx);
    setSelectedId(null);
    setSelectedIds([]);
    setCropId(null);
    requestAnimationFrame(() => {
      slideContainerRefs.current[idx]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  };

  const switchSlide = (idx: number) => {
    if (idx === activeSlideIdx) return;
    const updated = saveCurrentSlide();
    setSlides(updated);
    goToSlide(idx, updated);
  };

  const addSlide = () => {
    // Une story se publie image par image : plusieurs pages sous un même post
    // n'auraient jamais été publiées ensemble (retour Martin).
    if (postType === 'story') { showEditorToast(T('storyOnePage')); return; }
    const updated = saveCurrentSlide();
    const newSlide: Slide = { id: `slide-${Date.now()}`, elements: [], proxyUrl: '' };
    const newSlides = [...updated, newSlide];
    slidesRef.current = newSlides;
    setSlides(newSlides);
    goToSlide(newSlides.length - 1, newSlides);
  };

  // ── Carrousel "lié" façon Canva : étend l'image de fond de la slide active sur
  // les N slides suivantes, avec un décalage horizontal séquentiel — pour un
  // visuel continu (panorama) qui se découpe naturellement au balayage du
  // carrousel Instagram. Génération ponctuelle (pas de resynchronisation live
  // si on redéplace le fond ensuite) ; fonctionne mieux avec une photo large.
  const extendBgAcrossSlides = async (count: number) => {
    if (!proxyUrl) { showEditorToast(T('bgFirstToast')); return; }
    let natW = 0, natH = 0;
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error('load')); img.src = proxyUrl; });
      natW = img.naturalWidth; natH = img.naturalHeight;
    } catch { showEditorToast(T('imgNotFound')); return; }
    if (!natW || !natH) return;

    const scale = Math.max(stageW / natW, stageH / natH);
    const scaledW = natW * scale;
    const minOffsetX = stageW - scaledW; // borne la plus négative (clamp "cover")
    const clamp = (v: number) => Math.min(0, Math.max(minOffsetX, v));

    const groupId = `span-${Date.now()}`;
    let updated = saveCurrentSlide();
    const anchorOffsetX = clamp(bgOffsetX);
    updated = updated.map((s, i) => i === activeSlideIdx ? { ...s, spanGroupId: groupId, spanIndex: 0, bgOffsetX: anchorOffsetX } : s);

    for (let k = 1; k <= count; k++) {
      const targetIdx = activeSlideIdx + k;
      const wantedOffsetX = clamp(anchorOffsetX - k * stageW);
      if (targetIdx < updated.length) {
        updated[targetIdx] = { ...updated[targetIdx], proxyUrl, bgOffsetX: wantedOffsetX, bgOffsetY, spanGroupId: groupId, spanIndex: k };
      } else {
        updated = [...updated, { id: `slide-${Date.now()}-${k}`, elements: [], proxyUrl, bgOffsetX: wantedOffsetX, bgOffsetY, spanGroupId: groupId, spanIndex: k }];
      }
    }
    slidesRef.current = updated;
    setSlides(updated);
    setBgOffsetX(anchorOffsetX);
    if (scaledW < stageW * (count + 1)) {
      showEditorToast(T('spanNotWide', { count: count + 1 }));
    } else {
      showEditorToast(T('spanDone', { count: count + 1 }));
    }
  };

  // Réordonner les pages : l'ordre de la bande EST l'ordre de lecture du
  // carrousel. On déplace la page ET son entrée d'historique, sinon Cmd+Z
  // ramènerait un état sur la mauvaise page.
  const [slideDragIdx, setSlideDragIdx] = useState<number | null>(null);
  const [slideDragOverIdx, setSlideDragOverIdx] = useState<number | null>(null);

  const moveSlide = (from: number | null, to: number) => {
    setSlideDragIdx(null);
    setSlideDragOverIdx(null);
    if (from === null || from === to) return;
    const updated = saveCurrentSlide();
    if (from < 0 || from >= updated.length || to < 0 || to >= updated.length) return;
    const reordered = [...updated];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    slidesRef.current = reordered;
    setSlides(reordered);
    // Nouvel index de chaque ancienne position, pour suivre l'historique et la
    // page active à travers le déplacement.
    const newIndexOf = (old: number): number => {
      if (old === from) return to;
      if (from < to) return old > from && old <= to ? old - 1 : old;
      return old >= to && old < from ? old + 1 : old;
    };
    historyRef.current = historyRef.current.map(h => ({ ...h, slide: newIndexOf(h.slide) }));
    setActiveSlideIdx(newIndexOf(activeSlideIdxRef.current));
    setHistTick(t => t + 1);
  };

  const removeSlide = (idx: number) => {
    if (slidesRef.current.length <= 1) return;
    const updated = saveCurrentSlide();
    const newSlides = updated.filter((_, i) => i !== idx);
    slidesRef.current = newSlides;
    setSlides(newSlides);
    const newActive = idx >= newSlides.length ? newSlides.length - 1
      : idx < activeSlideIdx ? activeSlideIdx - 1
      : idx === activeSlideIdx ? Math.min(idx, newSlides.length - 1)
      : activeSlideIdx;
    // Les entrées d'historique pointent une page par son index : supprimer une
    // page décale les suivantes, il faut décaler l'historique avec elles.
    historyRef.current = historyRef.current
      .filter(h => h.slide !== idx)
      .map(h => (h.slide > idx ? { ...h, slide: h.slide - 1 } : h));
    if (!historyRef.current.length) historyRef.current = [{ slide: 0, els: newSlides[0].elements }];
    histIdxRef.current = Math.min(histIdxRef.current, historyRef.current.length - 1);
    setHistTick(t => t + 1);
    goToSlide(newActive, newSlides);
  };

  // ── Bascule Séparé ⇄ Continu — fusionne/redécoupe réellement les éléments ──
  // Avant ce correctif, la bascule ne faisait que changer un booléen : seule la
  // slide « active » restait visible dans la grande toile, les éléments des
  // AUTRES slides devenaient orphelins (invisibles) sans jamais être perdus en
  // base, ce qui donnait l'impression qu'un visuel « disparaissait » (retour Martin).
  const toggleCarouselMode = (toContinuous: boolean) => {
    if (toContinuous === carouselContinuous) return;
    const updated = saveCurrentSlide();
    if (toContinuous) {
      // Séparé → Continu : chaque slide i devient le volet i de la grande toile
      // (décalage horizontal de i × stageW), fusionnées en une seule slide.
      const panels = Math.max(2, Math.min(6, updated.length));
      const merged: CanvasEl[] = updated
        .slice(0, panels)
        .flatMap((s, i) => s.elements.map(el => ({ ...el, x: el.x + i * stageW })));
      const base = updated[0];
      const mergedSlide: Slide = { id: base?.id || 'slide-1', elements: merged, proxyUrl: base?.proxyUrl || '', bgOffsetX: base?.bgOffsetX, bgOffsetY: base?.bgOffsetY };
      slidesRef.current = [mergedSlide];
      setSlides([mergedSlide]);
      setActiveSlideIdx(0);
      setElements(merged);
      setProxyUrl(mergedSlide.proxyUrl);
      setBgOffsetX(mergedSlide.bgOffsetX ?? 0);
      setBgOffsetY(mergedSlide.bgOffsetY ?? 0);
      setSelectedId(null);
      setCropId(null);
      // Fusion/redécoupe : les index de page changent de sens, l'historique
      // d'avant ne s'y applique plus. C'est le seul cas où on repart de zéro.
      historyRef.current = [{ slide: 0, els: merged }];
      histIdxRef.current = 0;
      setHistTick(t => t + 1);
      setContPanels(panels);
    } else {
      // Continu → Séparé : redécoupe la grande toile en `contPanels` slides,
      // chaque élément rejoignant le volet où se trouve son bord gauche.
      const count = Math.max(2, Math.min(6, contPanels));
      const source = updated[activeSlideIdx] ?? updated[0];
      const buckets: CanvasEl[][] = Array.from({ length: count }, () => []);
      for (const el of source?.elements ?? []) {
        const idx = Math.min(count - 1, Math.max(0, Math.floor(el.x / stageW)));
        buckets[idx].push({ ...el, x: el.x - idx * stageW });
      }
      const newSlides: Slide[] = buckets.map((els, i) => ({
        id: i === 0 ? (source?.id || 'slide-1') : `slide-${Date.now()}-${i}`,
        elements: els,
        proxyUrl: source?.proxyUrl || '',
        bgOffsetX: (source?.bgOffsetX ?? 0) - i * stageW,
        bgOffsetY: source?.bgOffsetY ?? 0,
      }));
      slidesRef.current = newSlides;
      setSlides(newSlides);
      setActiveSlideIdx(0);
      setElements(newSlides[0].elements);
      setProxyUrl(newSlides[0].proxyUrl);
      setBgOffsetX(newSlides[0].bgOffsetX ?? 0);
      setBgOffsetY(newSlides[0].bgOffsetY ?? 0);
      setSelectedId(null);
      setCropId(null);
      historyRef.current = [{ slide: 0, els: newSlides[0].elements }];
      histIdxRef.current = 0;
      setHistTick(t => t + 1);
    }
    setCarouselContinuous(toContinuous);
  };

  const [saving, setSaving] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [qaBusy, setQaBusy] = useState(false);
  // Journal « ce que l'IA fait », révélé à la machine à écrire dans l'écran d'attente.
  // Alimenté par les étapes réelles de la composition et de l'audit visuel.
  const [edAiLog, setEdAiLog] = useState<string[]>([]);
  const edLog = (line: string) => setEdAiLog(l => (l[l.length - 1] === line ? l : [...l, line]));
  const [qaMsg, setQaMsg]   = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [aiVariants, setAiVariants] = useState<any[]>([]);
  const [aiVariantIdx, setAiVariantIdx] = useState(0);
  // Bulle « laquelle préférez-vous ? » : posée une fois, après une composition,
  // et refermée dès que la personne a tranché — jamais réaffichée derrière elle.
  const [variantAsked, setVariantAsked] = useState(false);
  // « Demander à Klip » vit sur la pastille de sélection, l'assistant en bas à
  // droite : deux composants sans lien. Ce compteur sert de signal d'ouverture —
  // chaque incrément déplie l'assistant.
  const [chatOpenSignal, setChatOpenSignal] = useState(0);
  const [aiBuilding, setAiBuilding] = useState(false);          // overlay "l'IA construit le visuel"
  const [autoComposeReady, setAutoComposeReady] = useState(false);
  // Sujet d'un post CARROUSEL jamais édité : le carrousel s'écrit tout seul à
  // l'ouverture, comme le prémontage côté vidéo. C'est là que les gens
  // commencent — depuis le Composer — pas dans le chat de l'éditeur.
  const [autoCarouselBrief, setAutoCarouselBrief] = useState<string | null>(null);
  const autoCarouselDoneRef = useRef(false);
  const autoComposeDoneRef = useRef(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ── Canvas zoom ───────────────────────────────────────────────────────────
  const [zoom, setZoom] = useState(1);
  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const slideContainerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [customFonts, setCustomFonts] = useState<{ name: string; url: string }[]>([]);
  const [brandFontNames, setBrandFontNames] = useState<string[]>([]);
  const [brandFamilies, setBrandFamilies] = useState<FontFamily[]>([]);
  /** Polices importées pour les AUTRES marques du compte : réutilisables ici. */
  const [accountFontNames, setAccountFontNames] = useState<string[]>([]);

  // LES TROIS ORIGINES D'UNE POLICE, dans l'ordre où on les cherche.
  //
  // La charte du client d'abord — c'est elle qui doit être choisie par défaut.
  // Puis les polices importées pour les AUTRES marques du compte : une police
  // achetée appartient à l'agence, pas au dossier dans lequel on l'a déposée.
  // Le catalogue maison en dernier, parce qu'il est long.
  const groupesDePolices = useMemo(() => {
    const charte = Array.from(new Set([...brandFontNames, ...customFonts.map(f => f.name)]));
    const vus = new Set(charte);
    const compte = accountFontNames.filter(n => !vus.has(n) && (vus.add(n), true));
    const catalogue = FONTS.filter(n => !vus.has(n));
    return [
      { label: 'Charte du client', fonts: charte },
      { label: 'Mes polices importées', fonts: compte },
      { label: 'Catalogue', fonts: catalogue },
    ].filter(g => g.fonts.length > 0);
  }, [brandFontNames, customFonts, accountFontNames]);

  // ── UI tool + workspace ───────────────────────────────────────────────────
  // Un template TOUT NEUF s'ouvre directement sur « Texte » — c'est là que
  // vivent les zones remplies par l'IA, le cœur d'un template. Un template
  // qu'on rouvre pour le modifier, lui, ne doit rien imposer : l'utilisateur
  // reprend où il en était, pas où on voudrait qu'il commence.
  const [tool, setTool] = useState<'design'|'elements'|'text'|'photos'|'brand'|'upload'|'calques'|null>(
    () => (mode === 'template' && (!templateId || templateId === 'new')) ? 'text' : null
  );
  // Panneau gauche contextuel (Effet / Position) ouvert depuis la barre de modification.
  const [fxPanel, setFxPanel] = useState<'effects'|'position'|null>(null);
  // Bibliothèque de combinaisons de texte (modale "Voir plus").
  const [textLibOpen, setTextLibOpen] = useState(false);
  const [textLibCat, setTextLibCat] = useState<string>('Tous');
  const [textLibQuery, setTextLibQuery] = useState('');
  const [ttCharter, setTtCharter] = useState(false); // « À ma charte » : recolore les templates de texte sur la palette de marque
  const [ltCharter, setLtCharter] = useState(true);  // idem pour les mises en page — activé par défaut : le client vient de définir sa charte
  const [ltCat, setLtCat] = useState<string>('Tous');
  const [ltStyle, setLtStyle] = useState<string>('Tous');
  const openFxPanel = (p: 'effects'|'position') => { setFxPanel(cur => cur === p ? null : p); setTool(null); };
  const [bgLocked, setBgLocked] = useState(true);
  const [bgImageSelected, setBgImageSelected] = useState(false);
  const [bgOpacity, setBgOpacity] = useState(100);
  const [workspaceName, setWorkspaceName] = useState('');
  const [templateName, setTemplateName] = useState('Nouveau template');
  const [postPhotoUrl, setPostPhotoUrl] = useState('');
  const [workspaceData, setWorkspaceData] = useState<{
    brand_voice_prompt?: string; company_description?: string;
    description_style?: string; caption_examples?: string;
    primary_color?: string; secondary_color?: string;
    accent_color?: string;
    logo_url?: string | null; logo_dark_url?: string | null;
    brand_assets?: string[] | null;
    font_family?: string; font_primary_url?: string | null; brand_fonts?: FontFamily[] | null;
    font_secondary?: string; font_secondary_url?: string | null;
    words_to_use?: string; words_to_avoid?: string;
    tone?: string; sector?: string;
  } | null>(null);

  // ── AI caption ───────────────────────────────────────────────────────────
  const [aiCaption, setAiCaption] = useState('');
  const [aiTyping, setAiTyping] = useState(false);
  // (Ancien ton forcé « Chic » retiré : le ton vient désormais toujours de la charte du client.)
  const aiTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [postContext, setPostContext] = useState('');        // 5B — contexte du post
  const [captionEdited, setCaptionEdited] = useState(false); // 5C — brand memory

  // ── Pen tool (Outil Plume) ────────────────────────────────────────────────
  const [isPenMode, setIsPenMode] = useState(false);
  const [penPoints, setPenPoints] = useState<AnchorPoint[]>([]);
  const [penPreviewPos, setPenPreviewPos] = useState<{ x: number; y: number } | null>(null);
  const penPointsRef = useRef<AnchorPoint[]>([]);
  const penDragOriginRef = useRef<{ x: number; y: number } | null>(null);
  const penIsDraggingRef = useRef(false);
  const isPenModeRef = useRef(false);
  useEffect(() => { isPenModeRef.current = isPenMode; }, [isPenMode]);
  useEffect(() => () => { if (aiTimerRef.current) clearInterval(aiTimerRef.current); }, []);

  // ── Schedule ─────────────────────────────────────────────────────────────
  const [schedDay, setSchedDay] = useState<number | null>(null);
  const SCHED_DAYS = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];

  // ── Load fonts ────────────────────────────────────────────────────────────

  useEffect(() => {
    // Chaque famille est chargée avec SES graisses (et ses italiques) : demander
    // 400/700/900 partout privait Oswald de son Light et faisait rendre les
    // autres graisses en faux gras synthétique.
    assurerPolicesGoogle(FONTS_AMORCE);
  }, []);

  // ── Zoom trackpad (pinch) — façon CapCut ─────────────────────────────────
  // Écouteur sur window (non passif) : tant que l'éditeur est monté, un pincement
  // NE zoome jamais la page du navigateur, même hors du plan de travail. Le point
  // sous le curseur reste fixe : on recale le scroll du conteneur après coup.
  const zoomRef = useRef(zoom);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const prev = zoomRef.current;
      // deltaY négatif = pincement vers l'extérieur = agrandir
      const next = Math.min(3, Math.max(0.15, prev * Math.exp(-e.deltaY * 0.008)));
      if (next === prev) return;
      zoomRef.current = next;
      setZoom(next);
      const area = canvasAreaRef.current;
      if (!area) return;
      const r = area.getBoundingClientRect();
      const px = e.clientX - r.left;
      const py = e.clientY - r.top;
      const k = next / prev;
      const targetLeft = (area.scrollLeft + px) * k - px;
      const targetTop = (area.scrollTop + py) * k - py;
      // Après le re-rendu : le contenu a changé de taille, le scroll peut suivre.
      requestAnimationFrame(() => {
        area.scrollLeft = targetLeft;
        area.scrollTop = targetTop;
      });
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, []);

  const stageWRef = useRef(FORMATS[0].w);
  const stageHRef = useRef(FORMATS[0].h);
  useEffect(() => { stageWRef.current = stageW; stageHRef.current = stageH; }, [stageW, stageH]);

  // ── Load post & workspace ─────────────────────────────────────────────────

  useEffect(() => {
    setDataLoading(true);
    setLoadError(null);
    const load = async () => {
      try {
        let p: any = null;
        let w: any = null;
        if (isTemplate) {
          // Mode template : on ne charge pas de post, seulement la charte (workspace).
          const wr = await supabase.from('workspaces').select('*').eq('id', workspaceId).maybeSingle();
          w = wr.data;
        } else {
          let postError: any;
          const [pr, wr] = await Promise.all([
            supabase.from('posts').select('*').eq('id', postId).maybeSingle(),
            supabase.from('workspaces').select('*').eq('id', workspaceId).maybeSingle(),
          ]);
          p = pr.data; postError = pr.error; w = wr.data;
          // Au refresh, la session peut ne pas être prête : si le post revient vide sans erreur,
          // on réessaie une fois (sinon on afficherait un canvas vide « déconnecté »).
          if (!p && !postError) {
            await new Promise(r => setTimeout(r, 600));
            const retry = await supabase.from('posts').select('*').eq('id', postId).maybeSingle();
            p = retry.data; postError = retry.error;
            if (!w) { const wr2 = await supabase.from('workspaces').select('*').eq('id', workspaceId).maybeSingle(); w = wr2.data; }
          }
          if (postError) throw postError;
          if (p?.template_id) setPostTemplateId(p.template_id);
          // Set canvas format from post_type (template will override below if applicable)
          const PT_FORMAT: Record<string, string> = { post: 'ig-portrait', reel: 'ig-story', story: 'ig-story', carrousel: 'ig-square' };
          if (p?.post_type && PT_FORMAT[p.post_type]) { setFormatId(PT_FORMAT[p.post_type]); setPostType(p.post_type as 'post' | 'reel' | 'story' | 'carrousel'); }
          if (p?.photo_url) { setPostPhotoUrl(p.photo_url); }
          // Un carrousel jamais édité s'écrit ENTIÈREMENT à l'ouverture, à partir du
          // sujet saisi dans le Composer. Il prime sur l'auto-composition photo :
          // celle-ci habille UNE image, elle ne sait pas produire des slides.
          // Le sujet est pris là où l'utilisateur l'a réellement écrit : le champ
          // « brief » du Composer d'abord, sinon le texte sur le visuel, sinon la
          // description. Exiger `brief` seulement faisait rater le cas — fréquent —
          // où la personne a tout dit dans le texte du visuel.
          const subject = [p?.brief, p?.texte_visuel, p?.description]
            .map((v) => String(v ?? '').trim()).find((v) => v.length > 2) ?? '';
          const wantCarousel = p?.post_type === 'carrousel' && !p?.editor_json && !!subject;
          if (wantCarousel) setAutoCarouselBrief(subject);
          // Post vierge (jamais édité, pas de template) + une photo -> l'IA composera automatiquement à l'ouverture.
          setAutoComposeReady(!wantCarousel && !p?.editor_json && !p?.template_id && !!p?.photo_url);
        }
        if (w) {
          setWorkspaceName(w.name || '');
          setWorkspaceData(w);
          // ── Load brand fonts ─────────────────────────────────────────────
          const bfNames: string[] = [];
          if (w.font_family) {
            bfNames.push(w.font_family);
            if (w.font_primary_url) {
              try { const ff = new FontFace(w.font_family, `url(${w.font_primary_url})`); await ff.load(); document.fonts.add(ff); } catch {}
            } else {
              const lnk = document.createElement('link'); lnk.rel = 'stylesheet';
              lnk.href = `https://fonts.googleapis.com/css2?family=${w.font_family.replace(/ /g, '+')}&display=swap`;
              document.head.appendChild(lnk);
            }
          }
          if (w.font_secondary) {
            bfNames.push(w.font_secondary);
            if (w.font_secondary_url) {
              try { const ff = new FontFace(w.font_secondary, `url(${w.font_secondary_url})`); await ff.load(); document.fonts.add(ff); } catch {}
            } else {
              const lnk = document.createElement('link'); lnk.rel = 'stylesheet';
              lnk.href = `https://fonts.googleapis.com/css2?family=${w.font_secondary.replace(/ /g, '+')}&display=swap`;
              document.head.appendChild(lnk);
            }
          }
          // Familles complètes de la charte : chaque graisse et chaque italique
          // est déclarée au navigateur, puis la famille rejoint le sélecteur.
          const fams = Array.isArray(w.brand_fonts) ? w.brand_fonts : [];
          for (const fam of fams) {
            if (!fam?.family || !Array.isArray(fam.variants)) continue;
            await registerFontFamily(fam);
            if (!bfNames.includes(fam.family)) bfNames.push(fam.family);
          }
          setBrandFamilies(fams);
          if (bfNames.length > 0) setBrandFontNames(bfNames);
        }
        const sw = stageWRef.current;
        const sh = stageHRef.current;
        // Bloc de secours — ce qu'on voit quand la composition IA n'a pas (encore)
        // tourné. Il était bâti sur deux couleurs de charte appariées à l'aveugle
        // (texte secondaire sur fond primaire : bleu sur vert, illisible) et posé
        // à 80 px du bas, donc coupé dès que le texte passait sur deux lignes.
        // Il n'a pas à être créatif, mais il doit être PROPRE.
        const defBg = w?.primary_color || '#0038FF';
        const defMargin = Math.round(sw * 0.06);
        const defSize = Math.max(18, Math.round(sh * 0.055));
        const defWidth = sw - defMargin * 2;
        const defLines = countLines(String(p?.texte_visuel || 'VOTRE TEXTE'), defSize, w?.font_family || 'Oswald', 'bold', defWidth - 28, 0);
        const defHeight = defLines * defSize * 1.2 + 20;
        const defaultEl: TextEl = {
          id: 'block-1', type: 'text',
          x: defMargin,
          // Ancré sur le BAS du cadre en tenant compte de sa hauteur réelle : le
          // bloc ne sort jamais par le bas, quel que soit le nombre de lignes.
          y: Math.max(defMargin, Math.round(sh - defMargin - defHeight)),
          rotation: 0, opacity: 100,
          text: p?.texte_visuel || 'VOTRE TEXTE',
          fontSize: defSize, fontFamily: w?.font_family || 'Oswald',
          fontStyle: 'bold', textDecoration: '',
          fill: inkOn(defBg),
          align: 'left', width: defWidth,
          // Aplat via l'effet « Arrière-plan » : un seul mécanisme dans toute l'app.
          hasBg: false, bgColor: defBg, bgOpacity: 100,
          highlightEnabled: true, highlightColor: defBg, highlightOpacity: 100,
          highlightBorderRadius: 6, highlightPadding: Math.max(6, Math.round(defSize * 0.22)),
          cornerRadius: 6, padding: 14, paddingH: 14, paddingV: 10,
        };
        const photoProxyUrl = p?.photo_url ? `/api/proxy-image?url=${encodeURIComponent(p.photo_url)}` : '';
        let initSlides: Slide[];
        /* Le re-calage des textes (relayoutText) DÉPLACE et REDIMENSIONNE les
           blocs, puis l'enregistrement automatique écrit le résultat. Il n'a de
           sens que sur des textes qui viennent d'être écrits dans un modèle,
           où la longueur du texte ne correspond pas à celle du dessin. Sur un
           visuel déjà enregistré, il défaisait la mise en page à chaque
           ouverture — le reproche de Martin, deux captures à l'appui : au
           rouvrir, son bandeau avait grandi et les deux blocs étaient
           descendus. */
        let dejaEnregistre = false;
        if (isTemplate) {
          // Mode template : charge le modèle depuis post_templates (ou vierge si "new").
          let tpl: any = null;
          if (templateId && templateId !== 'new') {
            const { data } = await supabase.from('post_templates').select('*').eq('id', templateId).maybeSingle();
            tpl = data;
          }
          if (tpl) {
            setTemplateName(tpl.name || 'Nouveau template');
            if (tpl.format_id && FORMATS.find(f => f.id === tpl.format_id)) setFormatId(tpl.format_id);
            setBgStyle((tpl.background_style as BgStyle) || { type: 'gradient', colorFrom: '#0038FF', colorTo: '#FFFFFF', angle: 135 });
            // Un template peut décrire plusieurs pages (carrousel). `text_zones`
            // reste la première page pour les templates enregistrés avant ça.
            const tplPages: { elements?: CanvasEl[] }[] = Array.isArray(tpl.pages) && tpl.pages.length
              ? tpl.pages
              : [{ elements: Array.isArray(tpl.text_zones) ? tpl.text_zones : [] }];
            initSlides = tplPages.map((pg, i) => ({
              id: `slide-${i + 1}`,
              elements: Array.isArray(pg?.elements) ? pg.elements : [],
              proxyUrl: '',
            }));
          } else {
            // Nouveau template : jamais une page blanche. On pose une base
            // complète — photo plein cadre, voile de lisibilité, un titre et un
            // sous-titre déjà à la charte du client — pour que la personne
            // n'ait plus qu'à déplacer et réécrire. Les deux zones portent un
            // rôle : c'est par elles que l'IA remplira le modèle.
            const brandInk = w?.secondary_color || '#FFFFFF';
            const brandFont = w?.font_family || 'Oswald';
            // Un plan de travail part TOUJOURS du blanc, comme dans n'importe quel
            // éditeur graphique : c'est la surface neutre sur laquelle on compose.
            // Il prenait la couleur principale du client, ce qui imposait un aplat
            // coloré dont on ne pouvait plus juger le reste. La couleur se choisit
            // en cliquant sur le fond.
            setBgStyle({ type: 'solid', color: '#FFFFFF' });
            const photoZone: ImageEl = {
              id: 'tpl-photo', type: 'image', src: PHOTO_PLACEHOLDER_SRC,
              x: 0, y: 0, rotation: 0, opacity: 100, width: sw, height: sh,
            };
            // Voile bas : sans lui, un titre clair devient illisible dès que la
            // photo est claire.
            const scrim: RectEl = {
              id: 'tpl-scrim', type: 'rect',
              x: 0, y: Math.round(sh * 0.45), width: sw, height: Math.round(sh * 0.55),
              rotation: 0, opacity: 62, fill: '#000000', stroke: '', strokeWidth: 0,
              cornerRadius: 0, scrim: 'bottom',
            } as RectEl;
            const titleZone: TextEl = {
              ...defaultEl,
              id: 'tpl-titre',
              text: 'TEXTE 1',
              role: 'titre',
              x: 24, y: Math.round(sh * 0.68),
              width: sw - 48,
              fontSize: Math.round(sw * 0.105),
              align: 'center',
              fontFamily: brandFont,
              fill: brandInk,
              hasBg: false,
              uppercase: true,
            };
            const subZone: TextEl = {
              ...defaultEl,
              id: 'tpl-sous-titre',
              text: 'Texte 2',
              role: 'sous-titre',
              x: 24, y: Math.round(sh * 0.68) + Math.round(sw * 0.155),
              width: sw - 48,
              fontSize: Math.round(sw * 0.042),
              align: 'center',
              fontFamily: brandFont,
              fill: brandInk,
              hasBg: false,
              uppercase: false,
            };
            initSlides = [{ id: 'slide-1', elements: [photoZone, scrim, titleZone, subZone], proxyUrl: '' }];
          }
        } else if (p?.editor_json) {
          // Saved state always wins — never re-apply template
          /* … et « tel quel » veut dire TEL QUEL : c'est l'utilisateur qui a
             placé ses blocs, on ne les recale pas derrière son dos. */
          dejaEnregistre = true;
          try {
            const parsed = JSON.parse(p.editor_json);
            if (parsed && parsed.version === 2 && Array.isArray(parsed.slides)) {
              initSlides = parsed.slides;
              // Le type du post a pu changer depuis la programmation (post → story…).
              // Si le visuel a été dessiné dans un autre format, on repositionne les
              // éléments au prorata du nouveau cadre au lieu de les laisser en place.
              const savedFmt = parsed.formatId ? FORMATS.find(f => f.id === parsed.formatId) : undefined;
              const targetFmtId = p?.post_type && PT_FORMAT_MAP[p.post_type] ? PT_FORMAT_MAP[p.post_type] : 'ig-portrait';
              const targetFmt = FORMATS.find(f => f.id === targetFmtId);
              if (savedFmt && targetFmt && savedFmt.id !== targetFmt.id) {
                initSlides = initSlides.map(s => ({
                  ...s,
                  elements: remapElementsToFormat(s.elements, savedFmt.w, savedFmt.h, targetFmt.w, targetFmt.h),
                }));
                setFormatChangedFrom({ from: savedFmt.label ?? savedFmt.id, to: targetFmt.label ?? targetFmt.id });
                // Le cadre a changé de proportions : là, oui, il faut recaler.
                dejaEnregistre = false;
              }
              // Restore bgStyle if embedded in the first slide (set by Composer pre-gen)
              if (parsed.slides[0]?.bgStyle) setBgStyle(parsed.slides[0].bgStyle as BgStyle);
              // Restore continuous-carousel mode
              if (parsed.carouselContinuous) { setCarouselContinuous(true); setContPanels(Math.min(6, Math.max(2, parsed.contPanels || 2))); }
            } else {
              const els = Array.isArray(parsed) ? parsed : [defaultEl];
              initSlides = [{ id: 'slide-1', elements: photoProxyUrl ? [photoLayer(photoProxyUrl, sw, sh), ...els] : els, proxyUrl: '' }];
            }
          } catch { initSlides = [{ id: 'slide-1', elements: photoProxyUrl ? [photoLayer(photoProxyUrl, sw, sh), defaultEl] : [defaultEl], proxyUrl: '' }]; }
        } else if (p?.template_id) {
          // Apply template for fresh posts
          const { data: tpl } = await supabase
            .from('post_templates')
            .select('*')
            .eq('id', p.template_id)
            .maybeSingle();

          if (tpl) {
            // Set canvas format from template
            const tplFormat = FORMATS.find(f => f.id === tpl.format_id);
            if (tplFormat) setFormatId(tpl.format_id);

            // Apply template background
            if (tpl.background_style) setBgStyle(tpl.background_style as BgStyle);

            const zones: CanvasEl[] = Array.isArray(tpl.text_zones) ? tpl.text_zones : [];
            const hasPhotoZone = zones.some(
              (e: CanvasEl) => e.type === 'image' && (e as ImageEl).src === PHOTO_PLACEHOLDER_SRC
            );

            // LE TEXTE GÉNÉRÉ DOIT ENTRER DANS LE TEMPLATE.
            //
            // Les zones du modèle étaient recopiées TELLES QUELLES, texte de
            // remplissage compris : choisir un template rendait donc un visuel
            // marqué « TEXTE 1 » et « Texte 2 », pendant que l'accroche écrite
            // par l'IA restait dans le panneau à côté. Sans template, elle était
            // bien injectée (bloc par défaut) — d'où l'impression que les deux
            // n'étaient « plus reliés ».
            //
            // On remplit par RÔLE, parce que c'est exactement ce que l'auteur du
            // template a déclaré en le dessinant : le bloc « Titre principal »
            // reçoit l'accroche, le sous-titre ou le corps reçoit la première
            // phrase de la légende.
            const estRemplissage = (t: string) =>
              /^(texte\s*\d*|votre texte|nouveau texte)$/i.test(String(t ?? '').trim());
            const accroche = String(p?.texte_visuel ?? '').trim();
            // Première phrase de la légende, sans les hashtags qui la terminent.
            const legende = String(p?.description ?? '').split(/#/)[0].trim();
            const phrase = (legende.match(/^[^.!?]+[.!?]?/)?.[0] ?? '').trim();

            const textes = zones.filter((e): e is TextEl => e.type === 'text');
            // À défaut de rôle déclaré, le plus gros bloc de texte EST le titre.
            const principal = textes.find(e => e.role === 'titre')
              ?? textes.find(e => e.role === 'accroche')
              ?? textes.slice().sort((a, b) => (b.fontSize ?? 0) - (a.fontSize ?? 0))[0];
            const secondaire = textes.find(e => e !== principal && (e.role === 'sous-titre' || e.role === 'corps'));

            const rempli = zones.map((el: CanvasEl) => {
              if (el.type !== 'text') return el;
              const te = el as TextEl;
              if (te === principal && accroche) return { ...te, text: accroche };
              if (te === secondaire && phrase && estRemplissage(te.text)) return { ...te, text: phrase };
              return te;
            });

            // Un bloc de remplissage laissé en place est pire qu'un bloc absent :
            // « Texte 2 » se retrouverait publié tel quel. Les textes FIXES voulus
            // par l'auteur (« NOUVEAU », un compte, un prix) ne correspondent à
            // aucun motif de remplissage et sont donc conservés.
            const nettoye = rempli.filter(el => !(el.type === 'text' && estRemplissage((el as TextEl).text)));

            // Replace photo placeholder with actual photo; assign fresh ids to avoid conflicts
            const initElements: CanvasEl[] = nettoye.map((el: CanvasEl) => {
              const freshId = el.id.startsWith('tpl-') ? el.id : `tpl-${el.id}`;
              if (el.type === 'image' && (el as ImageEl).src === PHOTO_PLACEHOLDER_SRC) {
                return { ...el, id: freshId, src: photoProxyUrl } as ImageEl;
              }
              return { ...el, id: freshId };
            });

            const bgUrl = hasPhotoZone ? '' : photoProxyUrl;
            initSlides = [{
              id: 'slide-1',
              elements: initElements.length > 0 ? initElements : [defaultEl],
              proxyUrl: bgUrl,
            }];
          } else {
            // Template not found — fallback to default
            initSlides = [{ id: 'slide-1', elements: photoProxyUrl ? [photoLayer(photoProxyUrl, sw, sh), defaultEl] : [defaultEl], proxyUrl: '' }];
          }
        } else {
          initSlides = [{ id: 'slide-1', elements: photoProxyUrl ? [photoLayer(photoProxyUrl, sw, sh), defaultEl] : [defaultEl], proxyUrl: '' }];
        }
        // Les visuels enregistrés AVANT ce changement portent encore une photo en
        // « fond » (proxyUrl). On la convertit en calque ordinaire à l'ouverture,
        // en reportant son cadrage — sinon ces posts resteraient prisonniers d'un
        // fond qu'on ne peut ni déplacer librement ni retoucher.
        initSlides = initSlides.map(sl => {
          if (!sl.proxyUrl) return sl;
          const already = sl.elements?.some(e => e.type === 'image' && (e as ImageEl).src === sl.proxyUrl);
          if (already) return { ...sl, proxyUrl: '' };
          const layer = photoLayer(sl.proxyUrl, sw, sh) as unknown as ImageEl;
          // Le fond était cadré en « cover » avec un décalage : on le transpose en
          // recadrage du calque, pour que l'image ne saute pas à l'ouverture.
          if (sl.bgOffsetX || sl.bgOffsetY) {
            layer.cropX = sl.bgOffsetX ?? 0;
            layer.cropY = sl.bgOffsetY ?? 0;
          }
          return { ...sl, proxyUrl: '', elements: [layer as unknown as CanvasEl, ...(sl.elements ?? [])] };
        });

        // LA CHARTE FAIT AUTORITÉ SUR LES CALQUES QU'ELLE A ÉCRITS.
        //
        // Modifier la typographie d'un client ne changeait rien aux visuels déjà
        // composés : le calque portait le nom de la police résolue le jour de la
        // composition, pas le rôle qu'elle jouait. On re-résout donc à chaque
        // ouverture les calques qui portent un `fontRole`, et EUX SEULS — un
        // calque dont quelqu'un a choisi la police à la main n'a plus de rôle,
        // et son choix est respecté.
        //
        // Placé AVANT `attendrePolices` : c'est la nouvelle police qu'il faut
        // attendre, sinon les largeurs sont mesurées sur l'ancienne.
        {
          const ft = resolveFonts({
            display: w?.font_family ?? null, body: w?.font_secondary ?? null,
            name: w?.name ?? null, sector: w?.sector ?? null, tone: w?.tone ?? null,
          });
          const parRole: Record<string, string> = {
            display: ft.display, body: ft.body, condensed: ft.condensed, serif: ft.serif, script: ft.script,
          };
          initSlides = initSlides.map(sl => ({
            ...sl,
            elements: (sl.elements ?? []).map((e: CanvasEl) => {
              if (e?.type !== 'text') return e;
              const te = e as TextEl & { fontRole?: string };
              const cible = te.fontRole ? parRole[te.fontRole] : null;
              return cible && cible !== te.fontFamily ? { ...te, fontFamily: cible } : e;
            }),
          }));
        }

        // Re-layout (Phase 2) : auto-fit + anti-chevauchement pour le format du post.
        // En mode template, on préserve la mise en page dessinée à la main (pas de relayout).
        if (!isTemplate && !dejaEnregistre) {
          const loadFmt = FORMATS.find(f => f.id === (p?.post_type && PT_FORMAT_MAP[p.post_type] ? PT_FORMAT_MAP[p.post_type] : 'ig-portrait')) ?? FORMATS[0];
          // Les polices d'abord : ce re-calage écrit largeurs et tailles dans le
          // document, il ne doit pas mesurer sur une typo de repli (cf.
          // attendrePolices).
          await attendrePolices(
            initSlides.flatMap(sl => (sl.elements ?? []).flatMap(e => {
              if (e?.type !== 'text') return [];
              const te = e as TextEl;
              const runs = Array.isArray(te.runs) ? te.runs.map(r => r.fontFamily) : [];
              return [te.fontFamily, ...runs];
            })).filter((f): f is string => !!f),
          );
          initSlides = initSlides.map(s => ({ ...s, elements: relayoutText(s.elements, loadFmt.w, loadFmt.h) }));
        }
        setSlides(initSlides);
        slidesRef.current = initSlides;
        const first = initSlides[0];
        setElements(first.elements);
        setProxyUrl(first.proxyUrl);
        // Bug 3: restore saved bg crop offsets
        setBgOffsetX(first.bgOffsetX ?? 0);
        setBgOffsetY(first.bgOffsetY ?? 0);
        historyRef.current = [{ slide: 0, els: first.elements }];
        histIdxRef.current = 0;
        if (w?.custom_fonts) {
          // UNE POLICE ILLISIBLE NE DOIT PAS EMPORTER LES AUTRES.
          //
          // La boucle chargeait les polices l'une après l'autre dans un seul
          // try : au premier `ff.load()` qui échouait — fichier supprimé du
          // stockage, URL expirée, format refusé par le navigateur — l'exception
          // sautait par-dessus `setCustomFonts`, et TOUTES les polices importées
          // disparaissaient du sélecteur d'un coup. C'est le symptôme rapporté :
          // « j'ai importé une typo, j'ai enregistré, elle n'est pas là ».
          //
          // Chaque police est maintenant isolée, et la liste est posée quoi qu'il
          // arrive : une famille qui n'a pas pu être chargée reste visible dans le
          // sélecteur plutôt que de s'évaporer en silence.
          try {
            const fonts: { name: string; url: string }[] = JSON.parse(w.custom_fonts);
            await Promise.all(fonts.map(async (font) => {
              try {
                const ff = new FontFace(font.name, `url(${font.url})`);
                await ff.load();
                document.fonts.add(ff);
              } catch (e) {
                console.warn('[Editor] police importée illisible :', font.name, e);
              }
            }));
            setCustomFonts(fonts);
          } catch (e) {
            console.warn('[Editor] liste de polices importées illisible', e);
          }
        }
      } catch (err) {
        setLoadError('Impossible de charger le post. Vérifiez votre connexion.');
        console.error('[Editor] load error:', err);
      } finally {
        setDataLoading(false);
      }
    };
    load();
  }, [postId, templateId, workspaceId, isTemplate]);

  // ── La bibliothèque de polices du COMPTE ─────────────────────────────────
  //
  // Les polices importées vivent dans `workspaces` : celles chargées pour un
  // client n'existaient que chez ce client. Une agence qui gère quinze marques
  // réimportait donc le même fichier quinze fois, et n'avait aucun moyen de
  // savoir ce qu'elle possédait déjà. Une police achetée est un actif du compte,
  // pas d'un dossier.
  //
  // Rien à changer en base : on relit les polices de TOUS les espaces auxquels
  // la personne a accès — la RLS reste seule juge de ce qui est lisible — et on
  // les ajoute au sélecteur dans leur propre groupe. Les polices de la marque en
  // cours gardent la priorité : ce sont elles, sa charte.
  //
  // Chargé à part et sans bloquer : une bibliothèque injoignable ne doit jamais
  // retarder l'ouverture de l'éditeur ni faire disparaître la charte.
  useEffect(() => {
    if (!workspaceId) return;
    let vivant = true;
    (async () => {
      try {
        const { data } = await supabase
          .from('workspaces')
          .select('brand_fonts, custom_fonts')
          .neq('id', workspaceId);
        if (!vivant || !Array.isArray(data)) return;

        const familles: FontFamily[] = [];
        const fichiers: { name: string; url: string }[] = [];
        for (const ws of data as { brand_fonts?: FontFamily[] | null; custom_fonts?: string | null }[]) {
          for (const fam of Array.isArray(ws.brand_fonts) ? ws.brand_fonts : []) {
            if (fam?.family && Array.isArray(fam.variants) && fam.variants.length) familles.push(fam);
          }
          try {
            const cf = ws.custom_fonts ? JSON.parse(ws.custom_fonts) : [];
            if (Array.isArray(cf)) for (const f of cf) if (f?.name && f?.url) fichiers.push(f);
          } catch { /* une liste illisible n'empêche pas les autres espaces */ }
        }

        await Promise.all(familles.map(f => registerFontFamily(f).catch(() => {})));
        await Promise.all(fichiers.map(async (f) => {
          try { const ff = new FontFace(f.name, `url(${f.url})`); await ff.load(); document.fonts.add(ff); } catch { /* noop */ }
        }));
        if (!vivant) return;

        // Les familles rejoignent `brandFamilies` : c'est là que le sélecteur de
        // graisse va chercher les variantes réelles d'une police importée.
        setBrandFamilies(prev => {
          const vus = new Set(prev.map(f => f.family));
          const ajout = familles.filter(f => { if (vus.has(f.family)) return false; vus.add(f.family); return true; });
          return ajout.length ? [...prev, ...ajout] : prev;
        });
        setAccountFontNames(prev => {
          const vus = new Set(prev);
          const noms = [...familles.map(f => f.family), ...fichiers.map(f => f.name)];
          const ajout = noms.filter(n => { if (vus.has(n)) return false; vus.add(n); return true; });
          return ajout.length ? [...prev, ...ajout].sort((a, b) => a.localeCompare(b)) : prev;
        });
      } catch { /* la bibliothèque partagée est un plus, jamais un blocage */ }
    })();
    return () => { vivant = false; };
  }, [workspaceId]);

  // 5s timeout
  useEffect(() => {
    if (!dataLoading) return;
    const t = setTimeout(() => { setLoadError('Chargement trop long. Réessayez.'); setDataLoading(false); }, 5000);
    return () => clearTimeout(t);
  }, [dataLoading]);

  // ── Auto-save continu (post uniquement — les templates se sauvegardent via
  // "Enregistrer le modèle") : évite de perdre du travail si l'utilisateur
  // quitte sans cliquer "Publier". Sauvegarde légère : juste le JSON, pas de
  // rendu/upload PNG ni de changement de statut (contrairement à handleSave).
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // L'export d'un carrousel et la génération IA font DÉFILER les pages dans le
  // canvas pour les photographier une à une. Pendant ce défilé, `elements` change
  // sans que la page active change : l'auto-save aurait écrit le contenu d'une
  // page par-dessus une autre. On le suspend le temps de l'opération.
  const busyWithSlidesRef = useRef(false);
  useEffect(() => {
    if (dataLoading || isTemplate || busyWithSlidesRef.current) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      const updated = saveCurrentSlide();
      setSlides(updated);
      // formatId est enregistré pour savoir, à la réouverture, sur quel format le
      // visuel a été dessiné — et donc pouvoir le réadapter si le type du post a
      // changé entre-temps (ex. passage post → story depuis la programmation).
      supabase.from('posts').update({ editor_json: JSON.stringify({ version: 2, formatId, slides: updated }) }).eq('id', postId).then(() => {});
    }, 1500);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elements, slides.length, formatId, postType, dataLoading, isTemplate, postId]);

  // ── Crop mode cursor ──────────────────────────────────────────────────────

  useEffect(() => {
    const container = stageRef.current?.container?.();
    if (container) container.style.cursor = cropId ? 'grab' : '';
  }, [cropId]);

  // ── Selected element ──────────────────────────────────────────────────────

  const selectedEl = elements.find(e => e.id === selectedId);

  // Quand une portion du texte est sélectionnée, la barre d'outils doit refléter
  // le style de CETTE portion (police, corps, couleur…), pas celui du bloc.
  const toolbarSel = React.useMemo(() => {
    if (!selectedEl || selectedEl.type !== 'text') return selectedEl;
    if (editingId !== selectedEl.id || !textRange || textRange.end <= textRange.start) return selectedEl;
    const tel = selectedEl as TextEl;
    const partial = styleOfRange(tel.runs, blockStyleOf(tel), (tel.text ?? '').length, textRange.start, textRange.end);
    return { ...tel, ...partial } as CanvasEl;
  }, [selectedEl, editingId, textRange]);

  // ── History ───────────────────────────────────────────────────────────────

  const pushHistory = (newEls: CanvasEl[]) => {
    const slice = historyRef.current.slice(0, histIdxRef.current + 1);
    historyRef.current = [...slice, { slide: activeSlideIdxRef.current, els: newEls }];
    histIdxRef.current = historyRef.current.length - 1;
    setHistTick(t => t + 1);
  };

  // Applique une entrée d'historique, en revenant d'abord sur SA page si on n'y
  // est plus — c'est ce qui rend Cmd+Z compréhensible sur un carrousel : on voit
  // toujours ce qui vient d'être annulé.
  const applyHistEntry = (entry: HistEntry) => {
    if (entry.slide !== activeSlideIdxRef.current) {
      const saved = saveCurrentSlide();
      // La page visée reçoit l'état annulé, pas celui qu'elle avait en la quittant.
      const target = saved.map((s, i) => (i === entry.slide ? { ...s, elements: entry.els } : s));
      slidesRef.current = target;
      setSlides(target);
      goToSlide(entry.slide, target);
    } else {
      setElements(entry.els);
      elementsRef.current = entry.els;
    }
    setSelectedId(null);
    setSelectedIds([]);
    setHistTick(t => t + 1);
  };

  const applyElements = (newEls: CanvasEl[], withHistory = true) => {
    setElements(newEls);
    if (withHistory) pushHistory(newEls);
  };

  // Pendant l'édition d'un texte, la frappe n'empile pas une entrée par
  // caractère : elle écrit directement dans elementsRef. Il faut donc poser un
  // point d'annulation à la sortie de l'édition — et le faire ici, pas dans le
  // champ lui-même : quitter en cliquant sur le plan de travail DÉMONTE le
  // champ sans déclencher son blur, et la modification n'entrait alors jamais
  // dans l'historique (Cmd+Z sautait par-dessus, la saisie était perdue).
  const editStartRef = useRef<CanvasEl[] | null>(null);

  // Empile l'état courant, sauf s'il y est déjà. Sert aux actions discrètes
  // faites pendant l'édition (appliquer une police à une portion) : chacune
  // reste annulable séparément.
  const commitEditSnapshot = useCallback(() => {
    const now = elementsRef.current;
    if (historyRef.current[histIdxRef.current]?.els !== now) {
      const slice = historyRef.current.slice(0, histIdxRef.current + 1);
      historyRef.current = [...slice, { slide: activeSlideIdxRef.current, els: now }];
      histIdxRef.current = historyRef.current.length - 1;
      setHistTick(t => t + 1);
    }
    editStartRef.current = now;
  }, []);

  // Fin d'édition : une seule entrée pour toute la saisie. Idempotente — peu
  // importe combien de fois la sortie est signalée (blur, Échap, démontage).
  const commitTextEdit = useCallback(() => {
    const before = editStartRef.current;
    editStartRef.current = null;
    if (!before || elementsRef.current === before) return;
    commitEditSnapshot();
    editStartRef.current = null;
  }, [commitEditSnapshot]);

  useEffect(() => {
    if (editingId) editStartRef.current = elementsRef.current;
    else commitTextEdit();
  }, [editingId, commitTextEdit]);

  // ── Assistant visuel : état envoyé à l'IA + exécution de ses actions ────────
  // Résumé des calques : assez pour raisonner (rôle, texte, position, style),
  // sans les données lourdes (sources d'images, points vectoriels).
  // Références de marque : gabarits du client + posts déjà validés. C'est ce qui
  // fait que l'assistant s'améliore à mesure que le client valide des visuels —
  // il compose comme ce qui a déjà été approuvé, pas dans le vide.
  // (Même source que composeWithAI, extraite ici pour être partagée.)
  const FMT_DIMS_REF: Record<string, [number, number]> = { 'ig-portrait': [420, 560], 'ig-square': [560, 560], 'ig-story': [315, 560], 'facebook': [560, 294] };
  const fetchBrandRefs = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const summarize = (zones: any[], fw: number, fh: number) => zones.filter(z => z?.type === 'text' && z.role).map(z => ({
      role: z.role, xPct: Math.round(((z.x ?? 0) / fw) * 100), yPct: Math.round(((z.y ?? 0) / fh) * 100),
      wPct: Math.round(((z.width ?? fw) / fw) * 100), fontPct: Math.round(((z.fontSize ?? 24) / fh) * 100),
      align: z.align ?? 'left', upper: !!z.uppercase,
    }));
    try {
      const [{ data: tpls }, { data: approved }] = await Promise.all([
        supabase.from('post_templates').select('name, format_id, background_style, text_zones').eq('workspace_id', workspaceId).limit(6),
        supabase.from('posts').select('post_type, editor_json').eq('workspace_id', workspaceId).eq('approved_by_client', true).limit(4),
      ]);
      const gabarits = (tpls ?? []).map(t => {
        const [fw, fh] = FMT_DIMS_REF[t.format_id as string] ?? [420, 560];
        return { nom: t.name, fond: (t.background_style as { type?: string } | null)?.type ?? 'none', blocs: summarize(Array.isArray(t.text_zones) ? t.text_zones : [], fw, fh) };
      }).filter(s => s.blocs.length > 0).slice(0, 4);
      const postsValides = (approved ?? []).map(p => {
        const [fw, fh] = FMT_DIMS_REF[(p.post_type as string) ? PT_FORMAT_MAP[p.post_type as string] : 'ig-portrait'] ?? [420, 560];
        try { const j = JSON.parse(p.editor_json as string); return { blocs: summarize(j?.slides?.[0]?.elements ?? [], fw, fh) }; }
        catch { return { blocs: [] }; }
      }).filter(s => s.blocs.length > 0).slice(0, 3);
      return { gabarits, postsValides };
    } catch { return { gabarits: [], postsValides: [] }; }
  };

  const buildChatProject = async () => ({
    cadre: { largeur: stageW, hauteur: stageH },
    // La charte : l'assistant ne propose que des couleurs et des polices du client.
    charte: {
      couleurPrimaire: workspaceData?.primary_color, couleurSecondaire: workspaceData?.secondary_color,
      couleurAccent: workspaceData?.accent_color, policeTitre: workspaceData?.font_family,
      policeTexte: workspaceData?.font_secondary, logo: !!workspaceData?.logo_url,
    },
    // Ce que le client a déjà validé → l'assistant s'aligne sur ses habitudes.
    references: await fetchBrandRefs(),
    // Rendu courant du visuel : l'assistant le REGARDE (équilibre, zones vides,
    // lisibilité sur la photo) au lieu de raisonner sur une liste de propriétés.
    image: (() => { try { return stageRef.current?.toDataURL({ pixelRatio: 1 }) ?? null; } catch { return null; } })(),
    calques: elementsRef.current.map((e, i) => {
      const base = { id: e.id, n: i + 1, type: e.type, x: Math.round(e.x), y: Math.round(e.y), opacite: Math.round(e.opacity ?? 100) };
      if (e.type === 'text') {
        const t = e as TextEl;
        return { ...base, role: t.role, texte: t.text, taille: Math.round(t.fontSize), couleur: t.fill,
          largeur: Math.round(t.width), alignement: t.align, majuscules: !!t.uppercase, police: t.fontFamily };
      }
      const s = e as unknown as { width?: number; height?: number; fill?: string; scrim?: string };
      return { ...base, largeur: s.width ? Math.round(s.width) : undefined, hauteur: s.height ? Math.round(s.height) : undefined,
        couleur: s.fill, voile: s.scrim };
    }),
  });

  // Applique les actions de l'assistant. Tout passe par applyElements → l'historique
  // enregistre un point d'annulation (Cmd+Z). Renvoie le nombre d'actions appliquées.
  const applyChatActions = async (actions: { type: string; [k: string]: unknown }[]): Promise<number> => {
    let done = 0;
    const num = (v: unknown, min: number, max: number, dflt: number) =>
      typeof v === 'number' && isFinite(v) ? Math.max(min, Math.min(max, v)) : dflt;
    const isHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
    // Cible : un id précis, ou tous les calques texte.
    const pick = (id: unknown) => (el: CanvasEl) => id === 'all_text' ? el.type === 'text' : el.id === id;

    let els = [...elementsRef.current];
    // `perEl` calcule un complément de patch qui DÉPEND de l'élément touché —
    // par exemple recentrer un bloc, ce qui exige de connaître sa largeur.
    const patchWhere = (
      match: (el: CanvasEl) => boolean,
      patch: Record<string, unknown>,
      perEl?: (el: CanvasEl) => Record<string, unknown>,
    ) => {
      let hit = 0;
      const runKeys = Object.keys(patch).filter(isRunKey);
      els = els.map(el => {
        if (!match(el)) return el;
        hit++;
        const extra = perEl ? perEl(el) : {};
        // Réglage typographique posé sur tout le calque : il doit l'emporter sur
        // d'éventuelles stylisations partielles de la même propriété.
        if (el.type === 'text' && runKeys.length) {
          const t = el as TextEl;
          return { ...t, ...patch, ...extra, runs: stripRunKeys(t.runs, runKeys, (t.text ?? '').length) } as CanvasEl;
        }
        return { ...el, ...patch, ...extra } as CanvasEl;
      });
      return hit;
    };

    for (const a of actions) {
      switch (a.type) {
        case 'set_text': {
          if (typeof a.text !== 'string') break;
          // Le texte est remplacé en entier : les runs, indexés sur l'ancienne
          // chaîne, ne veulent plus rien dire — on repart d'un calque uniforme.
          if (patchWhere(el => el.id === a.id && el.type === 'text', { text: a.text, runs: undefined })) done++;
          break;
        }
        case 'set_text_style': {
          const patch: Record<string, unknown> = {};
          if (typeof a.fontSize === 'number') patch.fontSize = Math.round(num(a.fontSize, 8, Math.round(stageH / 2), 24));
          if (isHex(a.fill)) patch.fill = a.fill;
          if (a.align === 'left' || a.align === 'center' || a.align === 'right') patch.align = a.align;
          if (typeof a.uppercase === 'boolean') patch.uppercase = a.uppercase;
          if (typeof a.letterSpacing === 'number') patch.letterSpacing = num(a.letterSpacing, -5, 30, 0);
          if (typeof a.lineHeight === 'number') patch.lineHeight = num(a.lineHeight, 0.6, 3, 1.2);
          if (typeof a.fontStyle === 'string' && /^(normal|bold|italic|italic bold)$/.test(a.fontStyle)) patch.fontStyle = a.fontStyle;
          if (!Object.keys(patch).length) break;
          // « Centre le texte » veut dire centrer le BLOC dans le cadre, pas
          // seulement aligner les lignes à l'intérieur d'une boîte restée sur le
          // côté. L'assistant appliquait bien align:center — et le visuel ne
          // bougeait pas, d'où l'impression qu'il n'écoutait rien. Même règle que
          // la composition automatique : un bloc centré est réellement centré.
          const centering = patch.align === 'center';
          if (patchWhere(el => el.type === 'text' && pick(a.id)(el), patch, centering
            ? (el) => ({ x: Math.round((stageW - ((el as TextEl).width ?? stageW)) / 2) })
            : undefined)) done++;
          break;
        }
        case 'move': {
          const el = els.find(e => e.id === a.id);
          if (!el) break;
          const patch: Record<string, unknown> = {};
          if (typeof a.x === 'number') patch.x = Math.round(num(a.x, 0, stageW - 10, el.x));
          if (typeof a.y === 'number') patch.y = Math.round(num(a.y, 0, stageH - 10, el.y));
          if (typeof a.width === 'number' && el.type === 'text') {
            const x = (patch.x as number | undefined) ?? el.x;
            patch.width = Math.round(num(a.width, 40, stageW - x, (el as TextEl).width));
          }
          if (!Object.keys(patch).length) break;
          if (patchWhere(e => e.id === a.id, patch)) done++;
          break;
        }
        case 'set_opacity': {
          if (patchWhere(e => e.id === a.id, { opacity: Math.round(num(a.opacity, 0, 100, 100)) })) done++;
          break;
        }
        case 'set_fill': {
          if (!isHex(a.fill)) break;
          if (patchWhere(e => pick(a.id)(e), { fill: a.fill })) done++;
          break;
        }
        case 'set_effect': {
          const on = a.on !== false;
          const map: Record<string, Record<string, unknown>> = {
            shadow: { shadowEnabled: on, ...(isHex(a.color) ? { shadowColor: a.color } : {}), ...(typeof a.intensity === 'number' ? { shadowOpacity: num(a.intensity, 0, 100, 75) } : {}) },
            highlight: { highlightEnabled: on, ...(isHex(a.color) ? { highlightColor: a.color } : {}), ...(typeof a.intensity === 'number' ? { highlightOpacity: num(a.intensity, 0, 100, 80) } : {}) },
            glow: { glowEnabled: on, ...(isHex(a.color) ? { glowColor: a.color } : {}), ...(typeof a.intensity === 'number' ? { glowIntensity: num(a.intensity, 0, 100, 50) } : {}) },
            hollow: { hollowEnabled: on },
            lift: { liftEnabled: on, ...(isHex(a.color) ? { liftColor: a.color } : {}) },
            echo: { echoEnabled: on, ...(isHex(a.color) ? { echoColor: a.color } : {}) },
          };
          const patch = map[String(a.effect)];
          if (!patch) break;
          if (patchWhere(el => el.type === 'text' && pick(a.id)(el), patch)) done++;
          break;
        }
        case 'add_text': {
          if (typeof a.text !== 'string' || !a.text.trim()) break;
          const x = Math.round(num(a.x, 0, stageW - 60, Math.round(stageW * 0.1)));
          els = [...els, {
            id: `ai-${Date.now()}-${done}`, type: 'text', text: a.text.trim(),
            x, y: Math.round(num(a.y, 0, stageH - 30, Math.round(stageH * 0.1))),
            rotation: 0, opacity: 100,
            fontSize: Math.round(num(a.fontSize, 8, Math.round(stageH / 2), 32)),
            fontFamily: 'Archivo', fontStyle: 'bold', textDecoration: '',
            fill: isHex(a.fill) ? a.fill : '#FFFFFF', align: 'left',
            width: Math.round(stageW * 0.8 > stageW - x ? stageW - x - 10 : stageW * 0.8),
            hasBg: false, bgColor: '#000000', bgOpacity: 45, cornerRadius: 6,
            padding: 0, paddingH: 0, paddingV: 0,
          } as CanvasEl];
          done++;
          break;
        }
        case 'delete': {
          const before = els.length;
          els = els.filter(e => e.id !== a.id);
          if (els.length !== before) done++;
          break;
        }
        case 'set_scrim': {
          const pos = a.position;
          els = els.filter(e => e.id !== 'scrim-overlay');
          if (pos === 'bottom' || pos === 'top') {
            els.unshift({
              id: 'scrim-overlay', type: 'rect', x: 0, y: 0, rotation: 0,
              opacity: Math.round(num(a.opacity, 20, 80, 60)),
              width: stageW, height: stageH, fill: '#000000', stroke: '', strokeWidth: 0,
              cornerRadius: 0, scrim: pos,
            } as CanvasEl);
          } else if (pos !== 'none') break;
          done++;
          break;
        }
        // Refonte complète : l'IA renvoie une mise en page (mêmes blocs que
        // /api/compose-layout) et on la matérialise avec la MÊME machinerie que
        // la composition automatique — couleurs de la charte, contraste calculé
        // sur la photo, voile de lisibilité si le fond est chargé. C'est ce qui
        // permet de « restructurer le visuel » et pas seulement de retoucher.
        case 'redesign': {
          if (!Array.isArray(a.blocks) || !a.blocks.length) break;
          if (done) applyElements(els);
          await materializeLayout({ blocks: a.blocks, scrim: a.scrim });
          return done + 1;
        }
        // Les deux IA déjà en place, déclenchables depuis la conversation. Elles
        // réécrivent elles-mêmes les calques : on applique d'abord ce qui précède.
        // Le carrousel remplace toutes les slides : on applique d'abord ce qui
        // précède, sinon les retouches en attente seraient écrasées sans trace.
        case 'generate_carousel': {
          if (done) applyElements(els);
          const brief = typeof a.brief === 'string' ? a.brief.trim() : '';
          if (!brief) break;
          const n = Math.max(3, Math.min(10, Math.round(typeof a.slides === 'number' ? a.slides : 6)));
          await generateCarousel(brief, n);
          return done + 1;
        }
        case 'compose': { if (done) applyElements(els); void composeWithAI(); return done + 1; }
        case 'visual_qa': { if (done) applyElements(els); void runVisualQA(); return done + 1; }
        default: break;
      }
    }
    if (done) applyElements(els);
    return done;
  };

  const layerAction = (action: 'front' | 'forward' | 'backward' | 'back') => {
    if (!selectedId) return;
    const arr = [...elementsRef.current];
    const idx = arr.findIndex(e => e.id === selectedId);
    if (idx === -1) return;
    const [el] = arr.splice(idx, 1);
    if (action === 'front') arr.push(el);
    else if (action === 'forward') arr.splice(Math.min(arr.length, idx + 1), 0, el);
    else if (action === 'backward') arr.splice(Math.max(0, idx - 1), 0, el);
    else arr.unshift(el);
    applyElements(arr);
  };

  // Réordonne toute la pile depuis la liste des calques (ordre avant→arrière).
  const reorderLayers = (frontToBackIds: string[]) => {
    const map = new Map(elementsRef.current.map(e => [e.id, e]));
    const arr = [...frontToBackIds].reverse().map(id => map.get(id)).filter(Boolean) as CanvasEl[];
    if (arr.length === elementsRef.current.length) applyElements(arr);
  };

  const updateEl = useCallback((id: string, updates: Partial<CanvasEl>) => {
    const newEls = elementsRef.current.map(e => e.id === id ? { ...e, ...updates } as CanvasEl : e);
    applyElements(newEls);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Réglage typographique venu de la barre d'outils. Deux portées possibles :
  //  • une portion est sélectionnée dans le texte en cours d'édition → on ne
  //    touche qu'à elle, via un run ;
  //  • sinon → tout le bloc, et on efface ces mêmes propriétés des runs
  //    existants pour que le réglage global reprenne bien la main.
  const updateTextAwareEl = useCallback((el: CanvasEl, patch: Partial<CanvasEl>) => {
    if (el.type !== 'text') { updateEl(el.id, patch); return; }
    const keys = Object.keys(patch);
    const runKeys = keys.filter(isRunKey);
    const scoped = runKeys.length === keys.length && runKeys.length > 0;
    if (scoped && editingIdRef.current === el.id) {
      const r = richRef.current?.getRange();
      if (r && r.end > r.start && richRef.current?.applyToSelection(patch as Record<string, unknown>)) {
        // Action discrète : elle mérite son propre point d'annulation, au lieu
        // d'être noyée dans l'entrée unique de la saisie.
        commitEditSnapshot();
        return;
      }
    }
    const tel = el as TextEl;
    updateEl(el.id, runKeys.length
      ? { ...patch, runs: stripRunKeys(tel.runs, runKeys, (tel.text ?? '').length) } as Partial<CanvasEl>
      : patch);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateEl, commitEditSnapshot]);

  const undo = useCallback(() => {
    if (histIdxRef.current <= 0) return;
    histIdxRef.current--;
    applyHistEntry(historyRef.current[histIdxRef.current]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const redo = useCallback(() => {
    if (histIdxRef.current >= historyRef.current.length - 1) return;
    histIdxRef.current++;
    applyHistEntry(historyRef.current[histIdxRef.current]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const deleteEl = useCallback((id?: string | null) => {
    // Sans id explicite, on supprime toute la sélection (lasso / shift-clic compris).
    const targets = id
      ? [id]
      : (selectedIdsRef.current.length > 0
          ? [...selectedIdsRef.current]
          : (selectedIdRef.current ? [selectedIdRef.current] : []));
    if (targets.length === 0) return;
    const newEls = elementsRef.current.filter(e => !targets.includes(e.id));
    applyElements(newEls);
    setSelectedId(null);
    setSelectedIds([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const duplicateEl = useCallback(() => {
    const id = selectedIdRef.current;
    if (!id) return;
    const el = elementsRef.current.find(e => e.id === id);
    if (!el) return;
    const dup = { ...el, id: newId(), x: el.x + 20, y: el.y + 20 };
    const newEls = [...elementsRef.current, dup];
    applyElements(newEls);
    setSelectedId(dup.id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Copier / Coller + menu contextuel (clic droit, façon Canva) ──────────
  // Le presse-papiers interne garde une LISTE : copier une sélection multiple doit
  // recoller le groupe entier en conservant les positions relatives.
  const clipboardRef = useRef<CanvasEl[]>([]);
  // Jeton écrit dans le presse-papiers système lors d'un copier interne.
  const clipStampRef = useRef<string | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; id: string } | null>(null);
  const copyEl = useCallback((id?: string | null) => {
    const ids = id
      ? [id]
      : (selectedIdsRef.current.length > 0
          ? selectedIdsRef.current
          : (selectedIdRef.current ? [selectedIdRef.current] : []));
    const els = elementsRef.current.filter(e => ids.includes(e.id));
    if (els.length === 0) return;
    clipboardRef.current = els.map(e => ({ ...e }));
    // On dépose un jeton dans le presse-papiers système : au collage, il permet
    // de distinguer « je recolle mes calques » de « je colle un texte venu
    // d'ailleurs » — sans lui, un vieux texte système volerait la place.
    const stamp = `klip-clip:${newId()}`;
    clipStampRef.current = stamp;
    void navigator.clipboard?.writeText(stamp).catch(() => { clipStampRef.current = null; });
  }, []);
  const pasteEl = useCallback(() => {
    const els = clipboardRef.current;
    if (els.length === 0) return;
    const dups = els.map(e => ({ ...e, id: newId(), x: e.x + 24, y: e.y + 24 }) as CanvasEl);
    applyElements([...elementsRef.current, ...dups]);
    setSelectedIds(dups.map(d => d.id));
    setSelectedId(dups[dups.length - 1].id);
  }, []);

  // ── Alignment (single vs canvas; multi vs group bounding box) ────────────

  const getElBox = (e: CanvasEl) => {
    if (e.type === 'circle') { const r = (e as CircleEl).radius; return { l: e.x - r, t: e.y - r, r: e.x + r, b: e.y + r, w: r*2, h: r*2, cx: e.x, cy: e.y }; }
    if (e.type === 'star') { const r = (e as StarEl).outerRadius; return { l: e.x - r, t: e.y - r, r: e.x + r, b: e.y + r, w: r*2, h: r*2, cx: e.x, cy: e.y }; }
    const w = 'width' in e ? (e as any).width : 100;
    let h: number;
    if (e.type === 'text') {
      h = measureBlock(e as TextEl, 20).blockH;
    } else {
      h = 'height' in e ? (e as any).height : 100;
    }
    return { l: e.x, t: e.y, r: e.x + w, b: e.y + h, w, h, cx: e.x + w/2, cy: e.y + h/2 };
  };

  // ── Guides magnétiques (smart guides) ─────────────────────────────────────
  // Aligne l'élément en cours de glissement sur les bords/centre du canvas et
  // sur les bords/centre des autres calques, dans un seuil de quelques px.
  const SNAP_THRESHOLD = 6;
  const computeSnap = (el: CanvasEl, candX: number, candY: number) => {
    const others = elementsRef.current.filter(o => o.id !== el.id && !hiddenIds.has(o.id));
    const box = getElBox(el);
    const dx = candX - el.x, dy = candY - el.y;
    const bl = box.l + dx, br = box.r + dx, bcx = box.cx + dx;
    const bt = box.t + dy, bb = box.b + dy, bcy = box.cy + dy;

    const vTargets = [0, stageW / 2, stageW, ...others.flatMap(o => { const b = getElBox(o); return [b.l, b.cx, b.r]; })];
    const hTargets = [0, stageH / 2, stageH, ...others.flatMap(o => { const b = getElBox(o); return [b.t, b.cy, b.b]; })];

    let bestVDelta: number | null = null, vGuide: number | null = null;
    for (const t of vTargets) {
      for (const val of [bl, bcx, br]) {
        const d = t - val;
        if (Math.abs(d) <= SNAP_THRESHOLD && (bestVDelta === null || Math.abs(d) < Math.abs(bestVDelta))) { bestVDelta = d; vGuide = t; }
      }
    }
    let bestHDelta: number | null = null, hGuide: number | null = null;
    for (const t of hTargets) {
      for (const val of [bt, bcy, bb]) {
        const d = t - val;
        if (Math.abs(d) <= SNAP_THRESHOLD && (bestHDelta === null || Math.abs(d) < Math.abs(bestHDelta))) { bestHDelta = d; hGuide = t; }
      }
    }
    return { x: candX + (bestVDelta ?? 0), y: candY + (bestHDelta ?? 0), vGuide, hGuide };
  };

  const handleElDragMove = (id: string, e: Konva.KonvaEventObject<DragEvent>) => {
    const ids = selectedIdsRef.current;
    if (ids.length > 1) {
      // Déplacement groupé : Konva ne bouge que le nœud tiré. On applique le même
      // delta aux autres nœuds sélectionnés à chaque frame (pas de setState ici,
      // sinon on repositionnerait le nœud tiré sous le curseur). Le commit dans
      // l'état React se fait au dragEnd.
      const start = multiDragStartRef.current[id];
      const stage = e.target.getStage();
      if (!start || !stage) return;
      const dx = e.target.x() - start.x;
      const dy = e.target.y() - start.y;
      for (const sid of ids) {
        if (sid === id) continue;
        const s = multiDragStartRef.current[sid];
        if (!s) continue;
        const node = stage.findOne(`#${sid}`);
        if (node) node.position({ x: s.x + dx, y: s.y + dy });
      }
      return; // pas de snap individuel pendant un déplacement groupé
    }
    const el = elementsRef.current.find(x => x.id === id);
    if (!el) return;
    const snapped = computeSnap(el, e.target.x(), e.target.y());
    e.target.position({ x: snapped.x, y: snapped.y });
    setGuides({ v: snapped.vGuide, h: snapped.hGuide });
  };

  const alignEl = (dir: string) => {
    const ids = selectedIds.length > 1 ? selectedIds : (selectedId ? [selectedId] : []);
    if (ids.length === 0) return;

    if (ids.length === 1) {
      // Single element: align relative to canvas
      const el = elements.find(e => e.id === ids[0]);
      if (!el) return;
      const box = getElBox(el);
      let patch: Record<string, number> = {};
      if (el.type === 'circle' || el.type === 'star') {
        const r = el.type === 'circle' ? (el as CircleEl).radius : (el as StarEl).outerRadius;
        if (dir === 'left') patch = { x: r }; else if (dir === 'right') patch = { x: stageW - r };
        else if (dir === 'center-h') patch = { x: stageW / 2 }; else if (dir === 'top') patch = { y: r };
        else if (dir === 'bottom') patch = { y: stageH - r }; else if (dir === 'center-v') patch = { y: stageH / 2 };
      } else {
        if (dir === 'left') patch = { x: 0 }; else if (dir === 'right') patch = { x: stageW - box.w };
        else if (dir === 'center-h') patch = { x: (stageW - box.w) / 2 }; else if (dir === 'top') patch = { y: 0 };
        else if (dir === 'bottom') patch = { y: stageH - box.h }; else if (dir === 'center-v') patch = { y: (stageH - box.h) / 2 };
      }
      updateEl(el.id, patch as Partial<CanvasEl>);
    } else {
      // Multi: align elements relative to each other
      const sels = elements.filter(e => ids.includes(e.id));
      const boxes = sels.map(e => ({ id: e.id, type: e.type, box: getElBox(e) }));
      const minL = Math.min(...boxes.map(b => b.box.l));
      const minT = Math.min(...boxes.map(b => b.box.t));
      const maxR = Math.max(...boxes.map(b => b.box.r));
      const maxB = Math.max(...boxes.map(b => b.box.b));
      const avgCx = (minL + maxR) / 2;
      const avgCy = (minT + maxB) / 2;
      const newEls = elements.map(e => {
        if (!ids.includes(e.id)) return e;
        const { box } = boxes.find(b => b.id === e.id)!;
        if (e.type === 'circle' || e.type === 'star') {
          if (dir === 'left') return { ...e, x: minL + box.w / 2 }; if (dir === 'right') return { ...e, x: maxR - box.w / 2 };
          if (dir === 'center-h') return { ...e, x: avgCx }; if (dir === 'top') return { ...e, y: minT + box.h / 2 };
          if (dir === 'bottom') return { ...e, y: maxB - box.h / 2 }; if (dir === 'center-v') return { ...e, y: avgCy };
        } else {
          if (dir === 'left') return { ...e, x: minL }; if (dir === 'right') return { ...e, x: maxR - box.w };
          if (dir === 'center-h') return { ...e, x: avgCx - box.w / 2 }; if (dir === 'top') return { ...e, y: minT };
          if (dir === 'bottom') return { ...e, y: maxB - box.h }; if (dir === 'center-v') return { ...e, y: avgCy - box.h / 2 };
        }
        return e;
      });
      applyElements(newEls);
    }
  };

  // ── Redimensionnement groupé ──────────────────────────────────────────────
  // Mise à l'échelle uniforme de toute la sélection autour du coin opposé à la
  // poignée tirée. Chaque élément garde sa place relative dans le groupe.

  const scaleSelection = (starts: Record<string, CanvasEl>, ids: string[], s: number, ax: number, ay: number) => {
    const next = elementsRef.current.map(e => {
      if (!ids.includes(e.id)) return e;
      const st = starts[e.id];
      if (!st) return e;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const out: any = { ...st, x: ax + (st.x - ax) * s, y: ay + (st.y - ay) * s };
      if (st.type === 'text') {
        const t = st as TextEl;
        out.fontSize = Math.max(8, t.fontSize * s);
        out.width = Math.max(20, (t.width ?? 200) * s);
        if (t.padding != null) out.padding = t.padding * s;
        if (t.paddingH != null) out.paddingH = t.paddingH * s;
        if (t.paddingV != null) out.paddingV = t.paddingV * s;
        if (t.letterSpacing) out.letterSpacing = t.letterSpacing * s;
        // Les morceaux stylés portent des valeurs absolues : ils suivent l'échelle.
        if (t.runs?.length) out.runs = t.runs.map(r => ({
          ...r,
          ...(r.fontSize !== undefined ? { fontSize: Math.max(8, r.fontSize * s) } : {}),
          ...(r.letterSpacing ? { letterSpacing: r.letterSpacing * s } : {}),
        }));
      } else if (st.type === 'circle') {
        out.radius = Math.max(4, (st as CircleEl).radius * s);
      } else if (st.type === 'star') {
        out.outerRadius = Math.max(6, (st as StarEl).outerRadius * s);
        out.innerRadius = Math.max(3, (st as StarEl).innerRadius * s);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const any = st as any;
        if (any.width != null) out.width = Math.max(4, any.width * s);
        if (any.height != null) out.height = Math.max(4, any.height * s);
        if (any.cropX != null) out.cropX = any.cropX * s;
        if (any.cropY != null) out.cropY = any.cropY * s;
        if (st.type === 'vector' && Array.isArray((st as VectorEl).points)) {
          out.points = (st as VectorEl).points!.map(p => ({
            x: p.x * s, y: p.y * s,
            ...(p.cpIn ? { cpIn: { x: p.cpIn.x * s, y: p.cpIn.y * s } } : {}),
            ...(p.cpOut ? { cpOut: { x: p.cpOut.x * s, y: p.cpOut.y * s } } : {}),
          }));
        }
      }
      return out as CanvasEl;
    });
    setElements(next);
    elementsRef.current = next;
  };

  const startGroupResize = (handleId: string, box: { l: number; t: number; r: number; b: number }) =>
    (ev: React.MouseEvent) => {
      ev.stopPropagation();
      ev.preventDefault();
      const ids = [...selectedIdsRef.current];
      const starts: Record<string, CanvasEl> = {};
      for (const id of ids) {
        const el = elementsRef.current.find(e => e.id === id);
        if (el) starts[id] = { ...el };
      }
      const w0 = Math.max(1, box.r - box.l);
      const h0 = Math.max(1, box.b - box.t);
      const ax = handleId.includes('l') ? box.r : box.l;   // coin opposé = point fixe
      const ay = handleId.includes('t') ? box.b : box.t;
      const dirX = handleId.includes('l') ? -1 : 1;
      const dirY = handleId.includes('t') ? -1 : 1;
      const startX = ev.clientX, startY = ev.clientY;
      const z = zoom;
      const onMove = (e: MouseEvent) => {
        const dx = ((e.clientX - startX) / z) * dirX;
        const dy = ((e.clientY - startY) / z) * dirY;
        const s = Math.max(0.05, Math.max((w0 + dx) / w0, (h0 + dy) / h0));
        scaleSelection(starts, ids, s, ax, ay);
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        const slice = historyRef.current.slice(0, histIdxRef.current + 1);
        historyRef.current = [...slice, { slide: activeSlideIdxRef.current, els: elementsRef.current }];
        histIdxRef.current = historyRef.current.length - 1;
        setHistTick(t => t + 1);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    };

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  // Alt maintenu : suivi globalement, parce que les gestionnaires de glissement
  // de Konva ne reçoivent pas tous l'événement d'origine. Remis à zéro quand la
  // fenêtre perd le focus, sinon un Alt+Tab laisserait la duplication armée.
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.altKey) altDownRef.current = true; };
    const up = (e: KeyboardEvent) => { if (!e.altKey) altDownRef.current = false; };
    const clear = () => { altDownRef.current = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
    };
  }, []);

  // Le gestionnaire n'est monté qu'une fois : il passe par ces refs pour appeler
  // la dernière version d'actions définies plus bas dans le composant.
  const handleSaveRef = useRef<(() => void | Promise<void>) | null>(null);
  const layerActionRef = useRef<((a: 'front' | 'forward' | 'backward' | 'back') => void) | null>(null);
  const zoomByRef = useRef<((factor: number) => void) | null>(null);
  const fitZoomRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Annuler / rétablir passent AVANT le garde-fou de saisie : un curseur ou
      // une case du panneau garde le focus après usage, et ⌘Z se perdait alors
      // dans un champ qui n'avait rien à annuler. Seuls les champs où l'on tape
      // gardent leur annulation native (cf. isTextEntry).
      if ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === 'z' || e.key.toLowerCase() === 'y') && !isTextEntry(e.target)) {
        e.preventDefault();
        if (e.key.toLowerCase() === 'y' || e.shiftKey) redo(); else undo();
        return;
      }
      if (isTypingTarget(e.target)) return;
      if (e.key === 'Escape') {
        if (isPenModeRef.current) {
          setIsPenMode(false); penPointsRef.current = []; setPenPoints([]); setPenPreviewPos(null);
          penDragOriginRef.current = null; penIsDraggingRef.current = false;
          return;
        }
        setSelectedId(null); setSelectedIds([]); setEditingId(null); return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') deleteEl();
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') { e.preventDefault(); duplicateEl(); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'c') { copyEl(); }
      // Cmd/Ctrl+V est géré par l'écouteur 'paste' (voir plus bas) pour pouvoir
      // aussi accepter une image venue d'une autre application.
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault();
        const ids = elementsRef.current.filter(el => !hiddenIds.has(el.id) && !lockedIds.has(el.id)).map(el => el.id);
        setSelectedIds(ids);
        setSelectedId(ids.at(-1) ?? null);
      }
      // Couper — copier puis supprimer, comme partout ailleurs.
      if ((e.metaKey || e.ctrlKey) && e.key === 'x') { e.preventDefault(); copyEl(); deleteEl(); }
      // Enregistrer.
      if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); void handleSaveRef.current?.(); }

      // Ordre des calques — convention Canva/Figma : ] devant, [ derrière,
      // avec Alt pour aller directement au premier/dernier plan.
      if ((e.metaKey || e.ctrlKey) && (e.key === ']' || e.key === '[')) {
        e.preventDefault();
        const toFront = e.key === ']';
        layerActionRef.current?.(e.altKey ? (toFront ? 'front' : 'back') : (toFront ? 'forward' : 'backward'));
      }

      // Zoom — Cmd +/− pour zoomer, Cmd 0 pour réajuster à l'écran.
      if ((e.metaKey || e.ctrlKey) && (e.key === '=' || e.key === '+' )) { e.preventDefault(); zoomByRef.current?.(1.1); }
      if ((e.metaKey || e.ctrlKey) && e.key === '-') { e.preventDefault(); zoomByRef.current?.(1 / 1.1); }
      if ((e.metaKey || e.ctrlKey) && e.key === '0') { e.preventDefault(); fitZoomRef.current?.(); }

      // Flèches : on pousse la sélection. 1px au doigt, 10px avec Maj — le
      // réflexe de tous les éditeurs, il manquait ici.
      if (!e.metaKey && !e.ctrlKey && e.key.startsWith('Arrow')) {
        const ids = selectedIdsRef.current.length > 0
          ? selectedIdsRef.current
          : (selectedIdRef.current ? [selectedIdRef.current] : []);
        if (ids.length === 0) return;
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        applyElements(elementsRef.current.map(el =>
          ids.includes(el.id) && !lockedIds.has(el.id) ? { ...el, x: el.x + dx, y: el.y + dy } : el
        ));
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [deleteEl, undo, redo, duplicateEl, copyEl, pasteEl, hiddenIds, lockedIds]);

  // ── Add elements ──────────────────────────────────────────────────────────

  // Tout texte neuf naît centré, et posé au milieu du cadre : c'est la mise en
  // page qu'on veut neuf fois sur dix, et la recaler soi-même à chaque fois
  // était une corvée.
  const newTextBox = (width?: number) => {
    const w = Math.min(width ?? 600, stageW - 80);
    return { x: Math.round((stageW - w) / 2), width: w };
  };

  const addText = () => {
    const box = newTextBox();
    const el: TextEl = { id: newId(), type: 'text', x: box.x, y: Math.round(stageH / 2 - 40), rotation: 0, opacity: 100, text: 'Nouveau texte', fontSize: 32, fontFamily: 'Oswald', fontStyle: 'bold', textDecoration: '', fill: '#FFFFFF', align: 'center', width: box.width, hasBg: false, bgColor: '#000000', bgOpacity: 80, cornerRadius: 4, padding: 16, paddingH: 16, paddingV: 10 };
    applyElements([...elements, el]);
    setSelectedId(el.id);
  };

  // Template mode: add a role-tagged text zone (AI-fillable)
  const addTextRole = (role: string) => {
    const preset: Record<string, { text: string; fontSize: number; fontStyle: string }> = {
      accroche: { text: 'ACCROCHE', fontSize: 15, fontStyle: 'bold' },
      titre: { text: 'TITRE PRINCIPAL', fontSize: 40, fontStyle: 'bold' },
      'sous-titre': { text: 'Sous-titre', fontSize: 20, fontStyle: 'normal' },
      corps: { text: 'Corps de texte', fontSize: 15, fontStyle: 'normal' },
      cta: { text: 'CALL TO ACTION', fontSize: 15, fontStyle: 'bold' },
      prix: { text: '00€', fontSize: 36, fontStyle: 'bold' },
    };
    const p = preset[role] ?? preset.titre;
    const el: TextEl = { id: newId(), type: 'text', x: 50, y: 100, rotation: 0, opacity: 100, text: p.text, fontSize: p.fontSize, fontFamily: 'Oswald', fontStyle: p.fontStyle, textDecoration: '', fill: '#FFFFFF', align: 'center', width: stageW - 100, hasBg: false, bgColor: '#000000', bgOpacity: 80, cornerRadius: 4, padding: 16, paddingH: 16, paddingV: 10, role };
    applyElements([...elements, el]);
    setSelectedId(el.id);
  };

  /** Zone PHOTO remplie par l'IA : c'est le même repère que le générateur
   *  remplace par l'image du post. Sans elle, un template ne peut accueillir
   *  aucune photo — seulement du texte. */
  const addPhotoZone = () => {
    if (elements.some((e) => e.type === 'image' && (e as ImageEl).src === PHOTO_PLACEHOLDER_SRC)) {
      showEditorToast(T('photoZoneExists'));
      return;
    }
    const el: ImageEl = {
      id: newId(), type: 'image', src: PHOTO_PLACEHOLDER_SRC,
      x: 0, y: 0, rotation: 0, opacity: 100, width: stageW, height: stageH,
    };
    // En premier dans la pile : une photo de fond passe DERRIÈRE les textes,
    // sinon elle les recouvre tous dès qu'on la pose.
    applyElements([el, ...elements]);
    setSelectedId(el.id);
  };

  // Insère un template de la bibliothèque (authoré sur 1080px) en le MISE À
  // L'ÉCHELLE du format réel du document (facteur = stageW / TT_REF_W) pour qu'il
  // s'adapte bien et ne déborde pas, quel que soit le format.
  // Applique une mise en page complète : elle REMPLACE la composition courante
  // (c'est le propre d'un modèle), mais passe par l'historique, donc Cmd+Z revient
  // à l'état d'avant. Les zones photo prennent la photo du post quand il y en a
  // une ; les emplacements secondaires restent des zones à remplir.
  // Modèles livrés AVEC leur visuel : les zones photo qui portent une requête
  // `stock` vont chercher une image de banque au moment où on applique le
  // modèle. Une seule requête par mot-clé, et on n'écrase jamais la photo du
  // post (slot 0) quand elle existe.
  const resolveStockPhotos = async (tpl: LayoutTemplate): Promise<Record<string, string>> => {
    const queries = Array.from(new Set(
      tpl.els
        .filter((el): el is Extract<typeof el, { kind: 'photo' }> => el.kind === 'photo')
        .filter(el => el.stock && !(el.slot === 0 && proxyUrl))
        .map(el => el.stock!)
    ));
    if (queries.length === 0) return {};
    const pairs = await Promise.all(queries.map(async q => {
      try {
        const res = await fetch(`/api/pexels?query=${encodeURIComponent(q)}&page=1`);
        if (!res.ok) return null;
        const data = await res.json();
        const url: string | undefined = data?.photos?.[0]?.src?.large || data?.photos?.[0]?.src?.medium;
        return url ? ([q, `/api/proxy-image?url=${encodeURIComponent(url)}`] as const) : null;
      } catch {
        return null;
      }
    }));
    return Object.fromEntries(pairs.filter(Boolean) as (readonly [string, string])[]);
  };

  const applyLayoutTemplate = async (tpl: LayoutTemplate) => {
    const W = stageW, H = stageH;
    const k = W / 1080; // pour les grandeurs déjà exprimées en points typo
    const stock = await resolveStockPhotos(tpl);

    // Les modèles sont dessinés en 3:4. Étirer leurs fractions sur une story
    // 9:16 déformait tout : photo démesurément haute, titres minuscules (leur
    // taille est une fraction de la LARGEUR), énorme vide en bas. On projette
    // donc la composition dans une zone au ratio d'origine, centrée — c'est ce
    // que fait le redimensionnement de Canva. Seuls les éléments plein cadre
    // (fonds, voiles) continuent de couvrir tout le plan de travail.
    const REF_RATIO = 3 / 4;
    const dW = Math.min(W, H * REF_RATIO);
    const dH = dW / REF_RATIO;
    const ox = Math.round((W - dW) / 2);
    const oy = Math.round((H - dH) / 2);
    const fullBleed = (el: { x: number; y: number; w: number; h: number }) =>
      el.x <= 0.001 && el.y <= 0.001 && el.w >= 0.999 && el.h >= 0.999;
    // Un élément plein cadre garde les coordonnées du plan de travail ; les
    // autres vivent dans la zone de composition.
    const box = (el: { x: number; y: number; w: number; h: number }) => fullBleed(el)
      ? { x: 0, y: 0, w: W, h: H }
      : { x: ox + el.x * dW, y: oy + el.y * dH, w: el.w * dW, h: el.h * dH };

    const out: CanvasEl[] = tpl.els.map(el => {
      if (el.kind === 'photo') {
        return {
          id: newId(), type: 'image',
          src: el.slot === 0 && proxyUrl
            ? proxyUrl
            : (el.stock && stock[el.stock]) || PHOTO_PLACEHOLDER_SRC,
          ...(b => ({
            x: Math.round(b.x), y: Math.round(b.y),
            width: Math.round(b.w), height: Math.round(b.h),
          }))(box(el)),
          rotation: el.rotation ?? 0, opacity: el.opacity ?? 100,
        } as ImageEl;
      }
      if (el.kind === 'rect') {
        return {
          id: newId(), type: 'rect',
          ...(b => ({
            x: Math.round(b.x), y: Math.round(b.y),
            width: Math.round(b.w), height: Math.round(b.h),
          }))(box(el)),
          fill: el.fill, stroke: el.stroke ?? '', strokeWidth: el.strokeWidth ?? 0,
          cornerRadius: Math.round((el.radius ?? 0) * dW),
          rotation: el.rotation ?? 0, opacity: el.opacity ?? 100,
          ...(el.scrim ? { scrim: el.scrim } : {}),
        } as RectEl;
      }
      const padH = Math.round((el.padH ?? 0) * dW);
      const padV = Math.round((el.padV ?? 0) * dH);
      return {
        id: newId(), type: 'text',
        x: Math.round(ox + el.x * dW), y: Math.round(oy + el.y * dH),
        width: Math.round(el.w * dW),
        text: el.text,
        fontSize: Math.max(8, Math.round(el.size * dW)),
        fontFamily: el.font ?? 'Oswald',
        fontStyle: el.weight === 'bold' ? 'bold' : 'normal',
        textDecoration: '',
        fill: el.fill,
        align: el.align ?? 'left',
        uppercase: !!el.uppercase,
        lineHeight: el.lineHeight ?? 1.2,
        letterSpacing: (el.letterSpacing ?? 0) * k,
        rotation: el.rotation ?? 0, opacity: el.opacity ?? 100,
        hasBg: !!el.bg, bgColor: el.bg ?? '#000000', bgOpacity: el.bgOpacity ?? 100,
        cornerRadius: Math.round((el.radius ?? 0) * dW),
        padding: padH, paddingH: padH, paddingV: padV,
      } as TextEl;
    });
    applyElements(out);
    setSelectedId(null);
    setSelectedIds([]);
    setTool(null);
  };

  const applyTextTemplate = (tpl: TextTemplate) => {
    const f = stageW / TT_REF_W;
    const cx = Math.round(stageW / 2);
    const baseY = Math.round(stageH * 0.18);
    const sc = (v: number | undefined, d = 0) => Math.round(((v ?? d) * f) * 100) / 100;
    const els: TextEl[] = tpl.parts.map(part => {
      const p = part.patch || {};
      const width = Math.round((p.width ?? 900) * f);
      const el: TextEl = {
        id: newId(), type: 'text', text: part.text, x: 0, y: 0, rotation: p.rotation ?? 0, opacity: 100,
        fontSize: Math.max(8, Math.round((p.fontSize ?? 44) * f)), fontFamily: p.fontFamily ?? 'Archivo Black',
        fontStyle: p.fontStyle ?? 'normal', textDecoration: '', fill: p.fill ?? '#14160F',
        align: p.align ?? 'center', width,
        hasBg: p.hasBg ?? false, bgColor: p.bgColor ?? '#000000', bgOpacity: p.bgOpacity ?? 100,
        cornerRadius: sc(p.cornerRadius, 8), padding: 16, paddingH: sc(p.paddingH, 22), paddingV: sc(p.paddingV, 14),
        ...(p.fillType ? { fillType: p.fillType, fillTo: p.fillTo, fillAngle: p.fillAngle } : {}),
        ...(p.uppercase ? { uppercase: true } : {}),
        ...(p.lineHeight != null ? { lineHeight: p.lineHeight } : {}),
        ...(p.letterSpacing != null ? { letterSpacing: sc(p.letterSpacing) } : {}),
        ...(p.stroke ? { stroke: p.stroke, strokeWidth: sc(p.strokeWidth, 2) } : {}),
        ...(p.highlightEnabled ? { highlightEnabled: true, highlightColor: p.highlightColor, highlightOpacity: p.highlightOpacity ?? 100, highlightBorderRadius: sc(p.highlightBorderRadius, 4), highlightPadding: sc(p.highlightPadding, 8) } : {}),
        ...(p.glowEnabled ? { glowEnabled: true, glowColor: p.glowColor, glowIntensity: p.glowIntensity ?? 60, glowSize: sc(p.glowSize, 10) } : {}),
        ...(p.liftEnabled ? { liftEnabled: true, liftColor: p.liftColor, liftDepth: sc(p.liftDepth, 6), liftDirection: p.liftDirection ?? 'br' } : {}),
        ...(p.echoEnabled ? { echoEnabled: true, echoColor: p.echoColor, echoCount: p.echoCount ?? 3, echoOffset: sc(p.echoOffset, 8), echoFade: p.echoFade } : {}),
        ...(p.shadowEnabled ? { shadowEnabled: true, shadowColor: p.shadowColor, shadowOffsetX: sc(p.shadowOffsetX, 4), shadowOffsetY: sc(p.shadowOffsetY, 4), shadowBlur: sc(p.shadowBlur, 0), shadowOpacity: p.shadowOpacity ?? 75 } : {}),
      };
      el.x = Math.round(cx - width / 2 + (part.dx ?? 0) * f);
      el.y = Math.round(baseY + part.dy * f);
      return el;
    });
    applyElements([...elements, ...els]);
    setSelectedId(els[0].id);
    setTool(null);
    setTextLibOpen(false);
  };

  // Template mode: add a replaceable photo zone (placeholder swapped by AI/user later)
  const addPhotoPlaceholder = () => {
    const w = Math.round(stageW * 0.6), h = Math.round(stageW * 0.6);
    const el: ImageEl = { id: newId(), type: 'image', src: PHOTO_PLACEHOLDER_SRC, x: Math.round((stageW - w) / 2), y: Math.round((stageH - h) / 2), rotation: 0, opacity: 100, width: w, height: h };
    applyElements([...elements, el]);
    setSelectedId(el.id);
    setTool(null);
  };

  const addVector = (shape: VectorEl['shape']) => {
    const defaultFill = workspaceData?.primary_color || '#2FD79B';
    const defaultSize: Record<VectorEl['shape'], [number, number]> = {
      rectangle: [200, 120], circle: [140, 140], triangle: [160, 140],
      star: [140, 140], pill: [220, 80], arrow: [200, 100],
      diamond: [140, 160], hexagon: [150, 150], custom: [160, 160],
    };
    const [w, h] = defaultSize[shape];
    const el: VectorEl = { id: newId(), type: 'vector', shape, x: Math.round((stageW - w) / 2), y: Math.round((stageH - h) / 2), rotation: 0, opacity: 100, width: w, height: h, fill: defaultFill, fillType: 'color', stroke: '', strokeWidth: 0 };
    applyElements([...elements, el]);
    setSelectedId(el.id);
    setTool(null);
  };

  // Cadre photo (pattern) : forme vide posée sur le plan de travail dans laquelle
  // on clippe une image (via le bouton Photo de la barre, ou double-clic pour recadrer).
  const addFrame = (shape: VectorEl['shape']) => {
    const base = Math.round(stageW * 0.44);
    const sizes: Record<VectorEl['shape'], [number, number]> = {
      rectangle: [base, Math.round(base * 0.72)], circle: [base, base], triangle: [base, Math.round(base * 0.9)],
      star: [base, base], pill: [base, Math.round(base * 0.52)], arrow: [base, Math.round(base * 0.6)],
      diamond: [Math.round(base * 0.86), base], hexagon: [base, base], custom: [base, base],
    };
    const [w, h] = sizes[shape];
    const el: VectorEl = { id: newId(), type: 'vector', shape, x: Math.round((stageW - w) / 2), y: Math.round((stageH - h) / 2), rotation: 0, opacity: 100, width: w, height: h, fill: '#E9EAEE', fillType: 'color', stroke: workspaceData?.primary_color || '#2FD79B', strokeWidth: 3 };
    applyElements([...elements, el]);
    setSelectedId(el.id);
    selectedIdRef.current = el.id;
    setTool(null);
    // Ouvre directement le sélecteur de photo pour remplir le cadre.
    setTimeout(() => maskPhotoInputRef.current?.click(), 60);
  };

  // ── Pen tool handlers ─────────────────────────────────────────────────────

  const cancelPenMode = () => {
    setIsPenMode(false);
    penPointsRef.current = [];
    setPenPoints([]);
    setPenPreviewPos(null);
    penDragOriginRef.current = null;
    penIsDraggingRef.current = false;
  };

  const finishPenPath = (closed: boolean) => {
    const pts = [...penPointsRef.current];
    if (pts.length < 2) { cancelPenMode(); return; }
    const xs = pts.map(p => p.x); const ys = pts.map(p => p.y);
    const minX = Math.min(...xs); const minY = Math.min(...ys);
    const maxX = Math.max(...xs); const maxY = Math.max(...ys);
    const w = Math.max(maxX - minX, 10); const h = Math.max(maxY - minY, 10);
    const relPts: AnchorPoint[] = pts.map(p => ({
      x: p.x - minX, y: p.y - minY,
      ...(p.cpIn  ? { cpIn:  { x: p.cpIn.x  - minX, y: p.cpIn.y  - minY } } : {}),
      ...(p.cpOut ? { cpOut: { x: p.cpOut.x - minX, y: p.cpOut.y - minY } } : {}),
    }));
    const el: VectorEl = {
      id: newId(), type: 'vector', shape: 'custom', x: minX, y: minY, rotation: 0, opacity: 100,
      width: w, height: h, fill: workspaceData?.primary_color || '#2FD79B',
      fillType: 'color', stroke: '', strokeWidth: 0, points: relPts, closed,
    };
    applyElements([...elementsRef.current, el]);
    setSelectedId(el.id);
    cancelPenMode();
  };

  const handlePenMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.detail >= 2) return; // belongs to dblclick — skip
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;
    // Close shape if clicking near first anchor point (≥3 points required)
    if (penPointsRef.current.length >= 3) {
      const first = penPointsRef.current[0];
      if (Math.hypot(x - first.x, y - first.y) < 14) { finishPenPath(true); return; }
    }
    penDragOriginRef.current = { x, y };
    penIsDraggingRef.current = false;
  };

  const handlePenMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;
    setPenPreviewPos({ x, y });
    if (penDragOriginRef.current && !penIsDraggingRef.current) {
      const d = penDragOriginRef.current;
      if (Math.hypot(x - d.x, y - d.y) > 5) penIsDraggingRef.current = true;
    }
  };

  const handlePenMouseUp = (e: React.MouseEvent<SVGSVGElement>) => {
    e.stopPropagation();
    const origin = penDragOriginRef.current;
    if (!origin) return; // skipped mousedown (part of dblclick)
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;
    let newPoint: AnchorPoint;
    if (penIsDraggingRef.current) {
      const dx = x - origin.x; const dy = y - origin.y;
      newPoint = { x: origin.x, y: origin.y, cpOut: { x: origin.x + dx, y: origin.y + dy }, cpIn: { x: origin.x - dx, y: origin.y - dy } };
    } else {
      newPoint = { x: origin.x, y: origin.y };
    }
    const next = [...penPointsRef.current, newPoint];
    penPointsRef.current = next;
    setPenPoints([...next]);
    penDragOriginRef.current = null;
    penIsDraggingRef.current = false;
  };

  const handlePenDblClick = (e: React.MouseEvent<SVGSVGElement>) => {
    e.stopPropagation();
    // Remove last point added by the first click of the dblclick
    if (penPointsRef.current.length > 1) penPointsRef.current = penPointsRef.current.slice(0, -1);
    if (penPointsRef.current.length >= 2) finishPenPath(false);
    else cancelPenMode();
  };

  const addImageEl = (src: string) => {
    const id = newId();
    const el: ImageEl = { id, type: 'image', x: 0, y: 0, rotation: 0, opacity: 100, src, width: stageW, height: stageH };
    applyElements([...elements, el]);
    setSelectedId(id);
    setCropId(id);
    setShowUnsplash(false);
  };

  // Ajoute un élément de charte (logo, icône, asset) sans recadrage : on lit le
  // ratio naturel et on l'inscrit ENTIER dans une boîte de 28% de la largeur.
  // Auparavant la boîte était carrée, donc le rendu « cover » de ImgNode rognait
  // les côtés de tout asset non carré.
  const addLogoEl = (src: string) => {
    const box = Math.round(stageW * 0.28);
    const place = (natW: number, natH: number) => {
      const ratio = natH / Math.max(1, natW);
      const w = ratio > 1 ? Math.round(box / ratio) : box;
      const h = Math.max(1, Math.round(w * ratio));
      const id = newId();
      const el: ImageEl = {
        id, type: 'image', x: 20, y: 20, rotation: 0, opacity: 100, src,
        width: w, height: h, naturalW: natW, naturalH: natH,
      };
      applyElements([...elementsRef.current, el]);
      setSelectedId(id);
      setSelectedIds([id]);
    };
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => place(img.naturalWidth || box, img.naturalHeight || box);
    img.onerror = () => place(box, box);
    img.src = src;
  };

  // Détache l'image de fond pour en faire un objet ordinaire : elle rejoint la pile
  // de calques (tout au fond) et devient déplaçable, redimensionnable, supprimable
  // comme n'importe quel élément. Le rendu ne bouge pas au moment de la bascule :
  // on reprend exactement la géométrie « cover » qu'appliquait BgImage.
  const detachBgToElement = () => {
    const src = proxyUrl;
    if (!src) return;
    const place = (natW: number, natH: number) => {
      const w = stageWView, h = stageH;
      const scale = (natW && natH) ? Math.max(w / natW, h / natH) : 1;
      const scaledW = natW ? natW * scale : w;
      const scaledH = natH ? natH * scale : h;
      const id = newId();
      const el: ImageEl = {
        id, type: 'image', rotation: 0, opacity: bgOpacity, src,
        x: Math.min(0, Math.max(w - scaledW, bgOffsetX)),
        y: Math.min(0, Math.max(h - scaledH, bgOffsetY)),
        width: scaledW, height: scaledH,
        naturalW: natW || undefined, naturalH: natH || undefined,
      };
      applyElements([el, ...elementsRef.current]); // en bas de la pile
      setProxyUrl('');
      setBgCropMode(false);
      setBgImageSelected(false);
      setSelectedId(id);
      setSelectedIds([id]);
      showEditorToast('Image libérée du fond : déplaçable comme un objet');
    };
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => place(img.naturalWidth, img.naturalHeight);
    img.onerror = () => place(0, 0);
    img.src = src;
  };

  const showEditorToast = (msg: string) => {
    setEditorToast(msg);
    setTimeout(() => setEditorToast(null), 4000);
  };

  // @imgly/background-removal ne reconnaît qu'une liste fermée de formats
  // (png/jpeg/webp) et rejette tout le reste avec une erreur brute
  // (« Invalid format: image/avif with params… ») — alors que le navigateur
  // sait très bien décoder l'image. On repasse systématiquement par un canvas
  // pour obtenir un PNG garanti compatible, quel que soit le format d'origine
  // (AVIF notamment, de plus en plus courant en sortie de banques d'images).
  const toPngBlob = async (blob: Blob): Promise<Blob> => {
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Contexte canvas indisponible');
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Conversion PNG échouée'))), 'image/png');
    });
  };

  // Détourage / suppression d'arrière-plan (100% côté client, sans clé API)
  const removeBgFromImage = async (el: ImageEl) => {
    if (bgRemovingId) return;
    setBgRemovingId(el.id);
    showEditorToast(T('cutoutInProgress'));
    try {
      let blob: Blob;
      try {
        const resp = await fetch(el.src);
        if (!resp.ok) throw new Error('fetch');
        blob = await resp.blob();
      } catch {
        const resp = await fetch(`/api/proxy-image?url=${encodeURIComponent(el.src)}`);
        blob = await resp.blob();
      }
      blob = await toPngBlob(blob);
      // Chargé depuis un CDN (webpackIgnore) : évite de bundler onnxruntime, dont le backend
      // Node casse le build. Le modèle IA est téléchargé depuis le CDN static d'imgly au 1er usage.
      // @ts-expect-error import CDN dynamique sans types
      const mod = await import(/* webpackIgnore: true */ 'https://esm.sh/@imgly/background-removal@1.7.0');
      const removeBackground = mod.removeBackground || mod.default?.removeBackground || mod.default;
      const outBlob: Blob = await removeBackground(blob);
      const path = `${workspaceId}/${entityId}-cutout-${Date.now()}.png`;
      const { error } = await supabase.storage.from('photos').upload(path, outBlob, { upsert: true, contentType: 'image/png' });
      if (error) { showEditorToast(T('uploadFailed', { msg: error.message })); return; }
      const { data: urlData } = supabase.storage.from('photos').getPublicUrl(path);
      // Le détouré a généralement un cadrage différent de la photo d'origine
      // (recentré sur le sujet) : le zoom figé de l'ancienne photo (imgScale)
      // ne doit pas lui être réappliqué, sinon le nouveau visuel apparaît
      // arbitrairement zoomé. Repart à zéro, recalculé au premier rendu.
      updateEl(el.id, { src: urlData.publicUrl, naturalW: undefined, naturalH: undefined, cropX: undefined, cropY: undefined, imgScale: undefined } as Partial<ImageEl>);
      showEditorToast(T('bgRemoved'));
    } catch (e) {
      showEditorToast(T('cutoutFailed', { msg: e instanceof Error ? e.message : T('cutoutError') }));
    } finally {
      setBgRemovingId(null);
    }
  };

  // Insère une image à sa taille naturelle (jamais recadrée), centrée sur le point
  // demandé — le curseur lors d'un dépôt, le centre du plan de travail sinon.
  const insertImageAtPoint = (src: string, point?: { x: number; y: number } | null) => {
    const place = (natW: number, natH: number) => {
      const maxW = Math.round(stageW * 0.5);
      const w = Math.min(natW, maxW);
      const h = Math.round(w * (natH / natW));
      const cx = point ? point.x : stageW / 2;
      const cy = point ? point.y : stageH / 2;
      const id = newId();
      const el: ImageEl = {
        id, type: 'image', rotation: 0, opacity: 100, src,
        x: Math.round(cx - w / 2), y: Math.round(cy - h / 2),
        width: w, height: h, naturalW: natW, naturalH: natH,
      };
      applyElements([...elementsRef.current, el]);
      setSelectedId(id);
      setSelectedIds([id]);
    };
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => place(img.naturalWidth || stageW, img.naturalHeight || stageH);
    img.onerror = () => place(stageW, stageH);
    img.src = src;
  };

  // Zone photo d'un modèle : elle attendait une image sans jamais dire comment
  // la lui donner. Un double-clic (ou le bouton de la barre contextuelle) ouvre
  // le sélecteur de fichiers et remplit CE calque, sans en créer un nouveau.
  const fillPhotoRef = useRef<HTMLInputElement | null>(null);
  const fillTargetRef = useRef<string | null>(null);

  const openPhotoPicker = (elementId: string) => {
    fillTargetRef.current = elementId;
    fillPhotoRef.current?.click();
  };

  const onFillPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const id = fillTargetRef.current;
    e.target.value = '';
    if (!file || !id || !file.type.startsWith('image/')) return;
    updateEl(id, { src: URL.createObjectURL(file) } as Partial<ImageEl>);
  };

  const handleFileDrop = (file: File, point?: { x: number; y: number } | null) => {
    if (!file.type.startsWith('image/')) return;
    if (postType === 'reel') {
      showEditorToast(T('reelNeedsVideo'));
      return;
    }
    insertImageAtPoint(URL.createObjectURL(file), point);
  };

  // Coordonnées écran → coordonnées du plan de travail (le conteneur du Stage est
  // mis à l'échelle en CSS par le zoom, on divise donc par le ratio réel du rect).
  const clientToStage = (clientX: number, clientY: number) => {
    const cont = stageRef.current?.container?.();
    if (!cont) return null;
    const r = cont.getBoundingClientRect();
    const sx = r.width / Math.max(1, stageWView);
    const sy = r.height / Math.max(1, stageH);
    return { x: (clientX - r.left) / (sx || 1), y: (clientY - r.top) / (sy || 1) };
  };

  // Dépôt sur le plan de travail : fichier depuis le bureau, ou vignette glissée
  // depuis un panneau. Sans ce handler, le navigateur ouvrait l'image dans un onglet.
  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverCanvas(false);
    const point = clientToStage(e.clientX, e.clientY);
    const file = Array.from(e.dataTransfer.files ?? []).find(f => f.type.startsWith('image/'));
    if (file) { handleFileDrop(file, point); return; }
    const url = e.dataTransfer.getData('application/x-klip-image')
      || e.dataTransfer.getData('text/uri-list')
      || e.dataTransfer.getData('text/plain');
    const clean = url?.split('\n')[0]?.trim();
    if (clean && /^(https?:\/\/|\/|data:image)/.test(clean)) {
      if (postType === 'reel') { showEditorToast(T('reelNeedsVideo')); return; }
      insertImageAtPoint(clean, point);
    }
  };

  // Ref pour que les écouteurs globaux appellent toujours la dernière version
  // (handleFileDrop capture postType / stageW / stageH).
  const handleFileDropRef = useRef(handleFileDrop);
  handleFileDropRef.current = handleFileDrop;

  // Coller un texte venu d'une autre application : il devient un calque texte,
  // centré au milieu du cadre comme tous les textes neufs.
  const pasteTextRef = useRef<((text: string) => void) | null>(null);
  pasteTextRef.current = (text: string) => {
    const clean = text.replace(/\r\n/g, '\n').slice(0, 2000);
    const box = newTextBox();
    const el: TextEl = {
      id: newId(), type: 'text', x: box.x, y: Math.round(stageH / 2 - 40), rotation: 0, opacity: 100,
      text: clean, fontSize: 32, fontFamily: 'Oswald', fontStyle: 'bold', textDecoration: '',
      fill: '#FFFFFF', align: 'center', width: box.width,
      hasBg: false, bgColor: '#000000', bgOpacity: 80, cornerRadius: 4, padding: 16, paddingH: 16, paddingV: 10,
    };
    applyElements([...elementsRef.current, el]);
    setSelectedId(el.id);
    setSelectedIds([el.id]);
  };

  // Coller une image venue d'une autre app (Finder, navigateur, capture d'écran).
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      // Coller dans un texte en cours d'édition insère des caractères ; ça ne
      // doit pas créer un calque texte ni recoller la sélection copiée.
      if (isTypingTarget(e.target)) return;
      const item = Array.from(e.clipboardData?.items ?? []).find(i => i.type.startsWith('image/'));
      const file = item?.getAsFile();
      const text = e.clipboardData?.getData('text/plain')?.trim() ?? '';
      e.preventDefault();
      // Une image dans le presse-papiers système gagne ; sinon un texte venu
      // d'ailleurs devient un calque texte (réflexe Canva) ; sinon on recolle la
      // sélection copiée dans l'éditeur. C'est ici (et pas dans le handler
      // keydown) que Cmd+V est traité : un preventDefault sur la touche
      // empêcherait justement cet événement de se déclencher.
      if (file) handleFileDropRef.current(file);
      else if (text && text !== clipStampRef.current) pasteTextRef.current?.(text);
      else pasteEl();
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    handleFileDrop(file);
  };

  const handleMaskPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedIdRef.current) return;
    e.target.value = '';
    const src = URL.createObjectURL(file);
    updateEl(selectedIdRef.current, { fillType: 'image', imageSrc: src, imageOffsetX: undefined, imageOffsetY: undefined } as Partial<VectorEl>);
    setMaskCropId(selectedIdRef.current);
  };

  // ── Unsplash ──────────────────────────────────────────────────────────────

  const fetchUnsplash = async (q: string) => {
    setUnsplashLoading(true);
    try {
      const key = process.env.NEXT_PUBLIC_UNSPLASH_KEY;
      if (key) {
        const res = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=12&client_id=${key}`);
        const data = await res.json();
        setUnsplashPhotos(data.results?.map((p: { urls: { small: string } }) => p.urls.small) ?? []);
      } else {
        setUnsplashPhotos(Array.from({ length: 12 }, (_, i) => `https://picsum.photos/seed/${q}${i}/300/300`));
      }
    } catch {
      setUnsplashPhotos(Array.from({ length: 12 }, (_, i) => `https://picsum.photos/seed/${q}${i}/300/300`));
    }
    setUnsplashLoading(false);
  };

  useEffect(() => { fetchUnsplash('lifestyle'); }, []);

  const fetchPexels = async (q: string, page = 1) => {
    setPexelsLoading(true);
    try {
      const res = await fetch(`/api/pexels?query=${encodeURIComponent(q || 'nature')}&page=${page}`);
      const data = await res.json();
      if (page === 1) setPexelsPhotos(data.photos ?? []);
      else setPexelsPhotos(prev => [...prev, ...(data.photos ?? [])]);
      setPexelsTotalPages(Math.ceil((data.total_results ?? 0) / 20));
      setPexelsPage(page);
    } catch { /* silently fail */ }
    setPexelsLoading(false);
  };

  useEffect(() => { fetchPexels('lifestyle'); }, []);

  // ── Photos réelles dans la bibliothèque de stickers (recherche) ─────────
  // Ex : « clavier » → illustrations maison + photos Pexels de clavier.
  useEffect(() => {
    const q = stickerLibQuery.trim();
    if (!stickerLibOpen || q.length < 2) { setStickerLibPhotos([]); return; }
    let cancelled = false;
    setStickerLibPhotoLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/pexels?query=${encodeURIComponent(q)}&page=1`);
        const data = await res.json();
        if (cancelled) return;
        const photos = (data.photos ?? []).slice(0, 18).map((p: { id: number; src: { medium: string; large: string }; alt: string }) => ({ id: p.id, thumb: p.src.medium, full: p.src.large, alt: p.alt || q }));
        setStickerLibPhotos(photos);
      } catch { if (!cancelled) setStickerLibPhotos([]); }
      if (!cancelled) setStickerLibPhotoLoading(false);
    }, 380);
    return () => { cancelled = true; clearTimeout(t); };
  }, [stickerLibQuery, stickerLibOpen]);

  // ── Icônes SVG (Iconify) ────────────────────────────────────────────────
  const fetchIcons = async (q: string) => {
    setIconLoading(true);
    try {
      const res = await fetch(`/api/iconify?query=${encodeURIComponent(q || 'star')}&limit=48`);
      const data = await res.json();
      setIconResults(data.icons ?? []);
    } catch { setIconResults([]); }
    setIconLoading(false);
  };
  useEffect(() => { fetchIcons('shape'); }, []);

  // URL SVG iconify ("prefix:name" → prefix/name.svg) avec couleur
  const iconSvgUrl = (name: string, color: string, h = 240) =>
    `https://api.iconify.design/${name.replace(':', '/')}.svg?height=${h}&color=${encodeURIComponent(color)}`;

  const addIcon = (name: string) => {
    addLogoEl(`/api/proxy-image?url=${encodeURIComponent(iconSvgUrl(name, iconColor))}`);
  };

  // ── Motifs / patterns (SVG généré, ajouté en pleine page) ────────────────
  const addPattern = (svg: string) => {
    const uri = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    addImageEl(uri);
  };

  // ── Stickers / illustrations maison recolorables ─────────────────────────
  const addSticker = (s: Sticker) => {
    const id = newId();
    const size = Math.round(stageW * 0.32);
    const el: ImageEl = { id, type: 'image', x: Math.round((stageW - size) / 2), y: Math.round((stageH - size) / 2), rotation: 0, opacity: 100, src: stickerDataUri(s, stickerColor), width: size, height: size };
    applyElements([...elements, el]);
    setSelectedId(id);
  };

  // ── Fit zoom ─────────────────────────────────────────────────────────────
  const fit = useCallback(() => {
    const ws = canvasAreaRef.current;
    if (!ws) return;
    const z = Math.min((ws.clientWidth - 120) / stageWView, (ws.clientHeight - 80) / stageH);
    setZoom(Math.max(0.05, Math.min(1.5, +z.toFixed(3))));
  }, [stageWView, stageH]);

  // Branchements pour les raccourcis clavier (cf. plus haut).
  fitZoomRef.current = fit;
  zoomByRef.current = (factor: number) => setZoom(z => Math.max(0.05, Math.min(3, +(z * factor).toFixed(3))));
  layerActionRef.current = layerAction;

  // Auto-fit after data loads and whenever the format (stageW/stageH) changes
  useEffect(() => {
    if (dataLoading) return;
    const id = requestAnimationFrame(() => fit());
    return () => cancelAnimationFrame(id);
  }, [dataLoading, fit]);

  // ── Z-order ───────────────────────────────────────────────────────────────

  const bringForward = () => {
    const idx = elements.findIndex(e => e.id === selectedId);
    if (idx < 0 || idx >= elements.length - 1) return;
    const n = [...elements]; [n[idx], n[idx + 1]] = [n[idx + 1], n[idx]]; applyElements(n);
  };

  const sendBackward = () => {
    const idx = elements.findIndex(e => e.id === selectedId);
    if (idx <= 0) return;
    const n = [...elements]; [n[idx], n[idx - 1]] = [n[idx - 1], n[idx]]; applyElements(n);
  };

  const moveUp = (idx: number) => {
    if (idx >= elements.length - 1) return;
    const n = [...elements]; [n[idx], n[idx + 1]] = [n[idx + 1], n[idx]]; applyElements(n);
  };

  const moveDown = (idx: number) => {
    if (idx <= 0) return;
    const n = [...elements]; [n[idx], n[idx - 1]] = [n[idx - 1], n[idx]]; applyElements(n);
  };

  const toggleHidden = (id: string) => {
    setHiddenIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  };
  const toggleLocked = (id: string) => {
    setLockedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  };

  // ── Export & save ─────────────────────────────────────────────────────────

  const exportPNG = () => {
    if (!stageRef.current) return;
    const prev = selectedId;
    setSelectedId(null);
    setTimeout(() => {
      const uri = stageRef.current.toDataURL({ pixelRatio: 2 });
      const a = document.createElement('a'); a.download = `klip-${Date.now()}.png`; a.href = uri; a.click();
      setSelectedId(prev);
    }, 80);
  };

  // ── Auto-correction visuelle par IA (Option A) ────────────────────────────
  // Capture le rendu → Claude vision repère les défauts → applique des corrections
  // bornées (taille / position / texte raccourci, jamais police ni couleur) → reboucle.
  const runVisualQA = async () => {
    if (!stageRef.current || qaBusy) return;
    setQaBusy(true);
    setEdAiLog([]);
    const prevSel = selectedId;
    setSelectedId(null);
    const nextFrame = () => new Promise<void>(r => requestAnimationFrame(() => r()));
    const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sanitizeFix = (el: any, fix: any) => {
      const out: Record<string, unknown> = {};
      // Taille : on n'agrandit jamais au-delà du design.
      if (typeof fix?.fontSize === 'number') out.fontSize = Math.max(10, Math.min(Math.round(fix.fontSize), el.fontSize));
      // Position : clampée dans le cadre.
      if (typeof fix?.x === 'number') out.x = Math.max(0, Math.min(Math.round(fix.x), stageW - 20));
      if (typeof fix?.y === 'number') out.y = Math.max(0, Math.min(Math.round(fix.y), stageH - 20));
      // Étirement de la zone (largeur) — borné au cadre.
      if (typeof fix?.width === 'number') {
        const x = typeof out.x === 'number' ? out.x as number : (el.x ?? 0);
        out.width = Math.max(60, Math.min(Math.round(fix.width), stageW - x - 12));
      }
      if (fix?.align === 'left' || fix?.align === 'center' || fix?.align === 'right') out.align = fix.align;
      if (typeof fix?.text === 'string' && fix.text.trim() && fix.text.length < (el.text?.length ?? 0)) out.text = fix.text.trim();
      // Voile (scrim) de lisibilité : fond NOIR neutre derrière le texte — jamais la couleur du texte.
      if (fix?.scrim === true) {
        out.hasBg = true;
        out.bgColor = '#000000';
        const op = typeof fix?.scrimOpacity === 'number' ? fix.scrimOpacity : 45;
        out.bgOpacity = Math.max(20, Math.min(op, 70));
        out.cornerRadius = el.cornerRadius ?? 6;
        if (!el.paddingH) out.paddingH = 18;
        if (!el.paddingV) out.paddingV = 10;
      }
      // Ombre de lisibilité : ombre sombre douce — seulement sur texte CLAIR (sinon moche).
      const fillNow = (out.fill as string) ?? el.fill ?? '#FFFFFF';
      const isLight = (() => { const m = /^#?([0-9a-f]{6})$/i.exec(fillNow); if (!m) return true; const n = parseInt(m[1], 16); return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255 > 0.5; })();
      if (fix?.shadow === true && isLight) {
        out.shadowEnabled = true; out.shadowColor = '#000000'; out.shadowOpacity = 38; out.shadowBlur = 12; out.shadowOffsetX = 0; out.shadowOffsetY = 0;
      } else if (fix?.shadow === false || (!isLight && el.shadowEnabled)) {
        // Retire une ombre inutile/moche (notamment sur texte foncé).
        out.shadowEnabled = false;
      }
      return out;
    };
    try {
      let applied = 0;
      for (let pass = 0; pass < 2; pass++) {
        await nextFrame(); await wait(120);
        const image = stageRef.current?.toDataURL({ pixelRatio: 1 });
        if (!image) break;
        const layers = elementsRef.current
          .filter(e => e.type === 'text')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((e: any) => ({ id: e.id, role: e.role, text: e.text, fontSize: e.fontSize, x: Math.round(e.x), y: Math.round(e.y), width: e.width }));
        setQaMsg(pass === 0 ? 'Analyse du rendu…' : 'Nouvelle vérification…');
        edLog(pass === 0 ? `Audit visuel du rendu (${layers.length} calque(s) texte)` : `Nouvelle passe de vérification (${pass + 1})`);
        const res = await fetch('/api/visual-qa', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image, layers, stageW, stageH }),
        });
        const data = await res.json();
        if (!res.ok) { setQaMsg(data?.error ?? 'Analyse échouée'); break; }
        const issues = Array.isArray(data.issues) ? data.issues : [];
        const scrimPos = data?.scrim?.position;
        const wantScrim = scrimPos === 'bottom' || scrimPos === 'top';
        const hasScrimEl = elementsRef.current.some(e => e.id === 'scrim-overlay');
        const scrimChange = wantScrim ? !hasScrimEl : (scrimPos === 'none' && hasScrimEl);
        if ((data.ok || issues.length === 0) && !scrimChange) {
          edLog(applied ? `Terminé — ${applied} correction(s) appliquée(s)` : 'Aucun défaut détecté, rendu validé');
          setQaMsg(applied ? `Corrigé (${applied}) ✓` : 'Rendu validé ✓'); break;
        }
        edLog(`${issues.length} défaut(s) repéré(s)${wantScrim ? ' + voile de lisibilité' : ''}`);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fixById = new Map<string, any>(issues.filter((i: any) => i?.id && i?.fix).map((i: any) => [i.id, i.fix]));
        let newEls = elementsRef.current.map(e => fixById.has(e.id) ? { ...e, ...sanitizeFix(e, fixById.get(e.id)) } as CanvasEl : e);
        // Dégradé global (scrim) derrière la zone de texte, pour la lisibilité sur fond clair/chargé.
        if (wantScrim) {
          const op = Math.max(20, Math.min(typeof data.scrim?.opacity === 'number' ? data.scrim.opacity : 65, 80));
          const scrimEl = { id: 'scrim-overlay', type: 'rect', x: 0, y: 0, rotation: 0, opacity: op, width: stageW, height: stageH, fill: '#000000', stroke: '', strokeWidth: 0, cornerRadius: 0, scrim: scrimPos } as CanvasEl;
          newEls = newEls.filter(e => e.id !== 'scrim-overlay');
          newEls.unshift(scrimEl); // derrière les autres calques, au-dessus de la photo
        } else if (scrimPos === 'none') {
          newEls = newEls.filter(e => e.id !== 'scrim-overlay');
        }
        applyElements(newEls);
        applied += fixById.size + (scrimChange ? 1 : 0);
        setQaMsg(`Optimisation de la composition…`);
        await wait(250);
      }
    } catch {
      setQaMsg('Erreur pendant l\'analyse');
    } finally {
      setSelectedId(prevSel);
      setQaBusy(false);
      setTimeout(() => setQaMsg(null), 2800);
    }
  };

  // ── Composition IA (directeur artistique) ─────────────────────────────────
  // Luminosité moyenne d'une zone de la photo (0=sombre, 1=clair) — pour la couleur intelligente.
  const buildLumaSampler = (url: string) => new Promise<((xp: number, yp: number, wp: number, hp: number) => { mean: number; std: number }) | null>(resolve => {
    try {
      const img = new Image(); img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const W = 160, H = Math.max(1, Math.round(W * img.height / Math.max(1, img.width)));
          const c = document.createElement('canvas'); c.width = W; c.height = H;
          const ctx = c.getContext('2d'); if (!ctx) { resolve(null); return; }
          ctx.drawImage(img, 0, 0, W, H);
          resolve((xp, yp, wp, hp) => {
            try {
              const x = Math.max(0, Math.floor(xp / 100 * W)), y = Math.max(0, Math.floor(yp / 100 * H));
              const w = Math.min(W - x, Math.max(1, Math.floor(wp / 100 * W))), h = Math.min(H - y, Math.max(1, Math.floor(hp / 100 * H)));
              const d = ctx.getImageData(x, y, w, h).data; let s = 0, s2 = 0, n = 0;
              for (let i = 0; i < d.length; i += 4) { const l = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255; s += l; s2 += l * l; n++; }
              if (!n) return { mean: 0.5, std: 0.2 };
              const mean = s / n; return { mean, std: Math.sqrt(Math.max(0, s2 / n - mean * mean)) };
            } catch { return { mean: 0.5, std: 0.2 }; }
          });
        } catch { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    } catch { resolve(null); }
  });
  const hexLum = (hex: string): number => {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return 1;
    const n = parseInt(m[1], 16); return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  };

  // Matérialise une variante de layout : couleur intelligente (contraste réel), accents, logo, scrim.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // ── Carrousel généré d'un bout à l'autre ────────────────────────────────────
  // L'éditeur savait habiller UNE slide (materializeLayout, prévue pour du texte
  // SUR PHOTO). Une slide de carrousel n'a pas de photo à habiller : elle doit se
  // tenir toute seule. La première version réutilisait quand même cette
  // machinerie, et rendait donc un aplat de couleur avec du texte centré dessus —
  // aucun design, retour de Martin, à raison.
  //
  // Le dessin vient maintenant de `lib/carouselDesigns.ts` : l'IA choisit un
  // archétype et écrit les textes, le moteur compose formes, chiffres géants,
  // cartes, pastilles et filets d'accent, aux couleurs de la charte.
  const generateCarousel = async (brief: string, slideCount: number) => {
    const res = await fetch('/api/compose-carousel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId, brief, slideCount }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !Array.isArray(data?.slides) || !data.slides.length) {
      showEditorToast(data?.error || T('carouselFailed'));
      return;
    }

    const theme = themeFromBrand(workspaceData ?? null);
    const total = data.slides.length;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const built: Slide[] = data.slides.map((s: any, i: number) => ({
      id: `slide-carousel-${Date.now()}-${i}`,
      proxyUrl: '',
      elements: buildCarouselSlide(String(s.archetype), s.texts ?? {}, theme, stageW, stageH, i + 1, total)
        .map((e) => ({ ...e, id: newId() }) as CanvasEl),
    }));

    slidesRef.current = built;
    setSlides(built);
    setProxyUrl('');
    setBgOffsetX(0);
    setBgOffsetY(0);
    setBgCropMode(false);
    setSelectedId(null);
    setCropId(null);

    // Les vignettes de la bande latérale sont captées depuis le canvas VIVANT
    // (saveCurrentSlide). Une slide jamais affichée n'en a donc aucune, et
    // s'affichait vide : le carrousel avait l'air de n'avoir qu'une slide.
    // On fait donc défiler chaque slide dans le canvas pour la photographier.
    const frame = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    busyWithSlidesRef.current = true;
    try {
      for (let i = 0; i < built.length; i++) {
        setActiveSlideIdx(i);
        setElements(built[i].elements);
        elementsRef.current = built[i].elements;
        await frame();
        built[i].thumbnail = stageRef.current?.toDataURL({ pixelRatio: 1.25 }) ?? undefined;
      }
    } finally {
      busyWithSlidesRef.current = false;
    }
    slidesRef.current = built;
    setSlides([...built]);

    // Retour à la première slide : c'est celle qu'on veut voir après génération.
    setActiveSlideIdx(0);
    setElements(built[0].elements);
    historyRef.current = [{ slide: 0, els: built[0].elements }];
    histIdxRef.current = 0;
    setHistTick((t) => t + 1);

    // La légende accompagne le carrousel : elle est écrite dans le même mouvement.
    // On ne l'écrase PAS si l'utilisateur a déjà retouché la sienne — les slides,
    // il les a demandées ; sa légende, non.
    if (typeof data.caption === 'string' && data.caption.trim() && !captionEdited) {
      setAiCaption(data.caption.trim());
    }
    showEditorToast(T('carouselDone', { n: built.length }));
  };

  // OÙ EST LA PHOTO DU POST ?
  //
  // Nulle part en particulier, et c'est bien le problème : selon le chemin, elle
  // est l'image de FOND (`proxyUrl`), un CALQUE posé à l'ouverture d'un post
  // vierge, ou seulement une URL en base. Chercher au seul endroit habituel
  // suffisait à la perdre — et une composition privée de sa photo ne montre plus
  // que l'aplat de couleur derrière.
  //
  // On regarde donc les trois, dans l'ordre. En dernier recours on prend la plus
  // GRANDE image du plan de travail : la petite, c'est le logo.
  const sourcePhotoDuPost = (): string => {
    if (proxyUrlRef.current) return proxyUrlRef.current;
    if (postPhotoUrl) return `/api/proxy-image?url=${encodeURIComponent(postPhotoUrl)}`;
    const images = elementsRef.current.filter(e => e.type === 'image' && !!(e as ImageEl).src) as ImageEl[];
    const aire = (e: ImageEl) => (e.width ?? 0) * (e.height ?? 0);
    return images.sort((a, b) => aire(b) - aire(a))[0]?.src ?? '';
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const materializeLayout = async (L: any) => {
    const displayFont = workspaceData?.font_family || 'Archivo';
    const bodyFont = workspaceData?.font_secondary || displayFont;

    // L'IA a repris un TEMPLATE MAISON : on applique son dessin complet — fond,
    // aplats, formes, couleurs — avec les textes qu'elle a écrits. Le réduire à
    // des positions de texte, comme avant, revenait à jeter le template.
    if (L?.template && Array.isArray(L.template.elements) && L.template.elements.length) {
      const src = L.template.sourceFormat ?? { w: stageW, h: stageH };
      const photoDuPost = sourcePhotoDuPost();
      const sx = stageW / Math.max(1, src.w);
      const sy = stageH / Math.max(1, src.h);
      const sf = Math.min(sx, sy); // tailles et rayons : échelle uniforme, pas de déformation
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const scaled: CanvasEl[] = L.template.elements.map((el: any, i: number) => {
        const out: Record<string, unknown> = { ...el, id: `ai-tpl-${i}-${newId()}` };
        out.x = Math.round((el.x ?? 0) * sx);
        out.y = Math.round((el.y ?? 0) * sy);
        if (typeof el.width === 'number') out.width = Math.round(el.width * sx);
        if (typeof el.height === 'number') out.height = Math.round(el.height * sy);
        if (typeof el.fontSize === 'number') out.fontSize = Math.max(11, Math.round(el.fontSize * sf));
        if (typeof el.radius === 'number') out.radius = Math.round(el.radius * sf);
        if (typeof el.cornerRadius === 'number') out.cornerRadius = Math.round(el.cornerRadius * sf);
        // La zone photo du template accueille la photo du post.
        if (el.type === 'image' && el.src === PHOTO_PLACEHOLDER_SRC) out.src = photoDuPost;
        return out as unknown as CanvasEl;
      })
        // Une zone photo sans photo est un trou invisible qu'on ne peut ni voir
        // ni sélectionner : mieux vaut ne pas la poser du tout.
        .filter((el: CanvasEl) => el.type !== 'image' || !!(el as ImageEl).src);
      if (L.template.backgroundStyle) setBgStyle(L.template.backgroundStyle as BgStyle);
      const famillesDuModele = [displayFont, bodyFont, ...scaled.flatMap(e => e.type === 'text' ? [(e as TextEl).fontFamily] : [])].filter((f): f is string => !!f);
      // Demander la feuille de style AVANT de l'attendre : sinon on attend une
      // police que personne n'a demandée, et on mesure sur le repli.
      assurerPolicesGoogle(famillesDuModele.filter(f => f !== displayFont && f !== bodyFont));
      await attendrePolices(famillesDuModele);
      applyElements(enforceDesignRules(relayoutText(scaled, stageW, stageH), stageW, stageH));
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const brandType = brandTypography(workspaceData ?? null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resolveColor = (c: any) => c === 'primary' ? (workspaceData?.primary_color || '#FFFFFF') : c === 'secondary' ? (workspaceData?.secondary_color || '#FFFFFF') : c === 'accent' ? (workspaceData?.accent_color || '#BDF2A0') : c === 'black' ? '#14160F' : '#FFFFFF';
    let sampler: ((xp: number, yp: number, wp: number, hp: number) => { mean: number; std: number }) | null = null;
    if (postPhotoUrl) { try { sampler = await buildLumaSampler(`/api/proxy-image?url=${encodeURIComponent(postPhotoUrl)}`); } catch { /* noop */ } }
    let forceScrim = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newTextEls: CanvasEl[] = (Array.isArray(L?.blocks) ? L.blocks : []).filter((b: any) => b?.text).map((b: any) => {
      let fill = resolveColor(b.color);
      let shadow = false;
      // Un aplat peut être IMPOSÉ ici quand la photo ne laisse pas d'autre choix
      // (cf. plus bas) : c'est la réponse d'un graphiste à un fond difficile.
      let forcedBox: string | null = null;
      if (sampler) {
        const { mean, std } = sampler(b.xPct ?? 8, b.yPct ?? 70, b.widthPct ?? 80, Math.min(45, (b.fontPct ?? 7) * 2.6));
        const busy = std > 0.17;                 // zone chargée (mélange clair/sombre) = risque d'illisibilité
        const fillLum = hexLum(fill);
        const contrastOK = !busy && Math.abs(mean - fillLum) > 0.45;
        if (busy) {
          // Fond chargé. L'ancienne réponse — texte blanc + voile noir — était
          // lisible mais effaçait la marque : c'est elle qui produisait le rendu
          // générique « du texte posé sur une photo », quel que soit le client.
          // On pose plutôt la MATIÈRE de la marque derrière le texte : la charte
          // reste visible ET la lisibilité est garantie par construction.
          const brand = workspaceData?.primary_color || workspaceData?.accent_color;
          if (brand && !b.box) {
            forcedBox = brand;
          } else {
            fill = '#FFFFFF'; shadow = true; forceScrim = true;
          }
        } else if (!contrastOK) {
          fill = mean > 0.5 ? '#14160F' : '#FFFFFF';     // fond uni : noir sur clair, blanc sur sombre
          shadow = fill === '#FFFFFF' && mean > 0.5;
        }
        // sinon : la couleur choisie par l'IA a un bon contraste, on la garde telle quelle.
      } else {
        shadow = hexLum(fill) > 0.5 && !!b.shadow;
      }
      // L'alignement redevient celui de la MISE EN PAGE choisie.
      //
      // Il était forcé au centre pour tout le monde — décision prise à l'époque
      // contre des blocs qui semblaient flotter de travers. Mais le vrai centrage
      // dans le cadre (juste en dessous) a corrigé ce défaut depuis, et la règle
      // ne faisait plus qu'écraser les 18 compositions de la bibliothèque en une
      // seule : « magazine bas-gauche » et « hero centré » sortaient identiques.
      // C'était la première cause du « tout se ressemble ».
      const align = ['left', 'center', 'right'].includes(b.align) ? b.align : 'center';
      const width = Math.round((Math.min(Math.max(b.widthPct ?? 80, 10), 100) / 100) * stageW);
      // Un bloc centré est RÉELLEMENT centré dans le cadre (sinon ça paraît « de
      // travers ») ; les blocs alignés, eux, respectent la marge de la recette.
      const x = align === 'center'
        ? Math.round((stageW - width) / 2)
        : align === 'right'
          ? Math.max(0, Math.round(stageW - width - ((b.xPct ?? 8) / 100) * stageW))
          : Math.max(0, Math.round(((b.xPct ?? 8) / 100) * stageW));
      // Aplat de marque derrière le texte (cartouche, bandeau, pastille) : c'est
      // la recette qui le décide. Sur un aplat, la lisibilité ne dépend plus de la
      // photo — la couleur du texte se déduit du fond posé, et le halo n'a plus lieu d'être.
      const boxFill = b.box === 'brand' ? resolveColor('primary')
        : b.box === 'accent' ? resolveColor('accent')
        : b.box === 'white' ? '#FFFFFF'
        : b.box === 'black' ? '#14160F'
        : forcedBox;
      // Le rythme typographique de CETTE marque : le titre et le sous-titre ne
      // se répondent pas de la même façon chez un caviste et chez une marque de
      // sport, même à recette identique.
      const isSub = b.role === 'sous-titre' || b.role === 'corps';
      const typoScale = isSub ? brandType.subScale : brandType.titleScale;
      const fontSize = Math.max(12, Math.round(((b.fontPct ?? 7) / 100) * stageH * typoScale));
      if (boxFill) {
        fill = hexLum(boxFill) > 0.55 ? '#14160F' : '#FFFFFF';
        shadow = false;
      }
      return {
        id: newId(), type: 'text', text: String(b.text),
        x, y: Math.max(0, Math.round(((b.yPct ?? 70) / 100) * stageH)),
        width,
        rotation: 0, opacity: 100,
        fontSize,
        fontFamily: b.role === 'sous-titre' ? bodyFont : displayFont,
        fontStyle: b.role === 'sous-titre' ? 'normal' : brandType.titleWeight, textDecoration: '',
        // Interlettrage : serré pour une marque qui frappe, aéré pour une marque
        // qui pose. C'est ce détail qui distingue deux affiches par ailleurs identiques.
        letterSpacing: isSub ? 0 : brandType.tracking,
        fill, align,
        // L'aplat passe par l'effet « Arrière-plan » — le même réglage que celui
        // offert à l'utilisateur, et le seul qui épouse chaque ligne de texte.
        hasBg: false, bgColor: '#000000', bgOpacity: 80,
        ...(boxFill ? {
          highlightEnabled: true,
          highlightColor: boxFill,
          highlightOpacity: 100,
          // radiusPct = % de la hauteur du texte : 50 donne une pastille, 0 un bandeau net.
          // Le défaut était 8 : ni l'un ni l'autre, l'arrondi mou qu'on reconnaît
          // sur tous les visuels générés. Sans consigne, on coupe net.
          highlightBorderRadius: Math.round(((b.radiusPct ?? 0) / 100) * fontSize),
          highlightPadding: Math.max(6, Math.round(fontSize * 0.34)),
        } : {}),
        cornerRadius: 6,
        padding: 16, paddingH: 16, paddingV: 10,
        role: b.role || 'titre',
        // La recette peut imposer les capitales ; sinon c'est la marque qui décide.
        uppercase: b.uppercase === undefined ? (!isSub && brandType.upper) : !!b.uppercase,
        // Ombre = halo doux de lisibilité (offset 0, flou large, faible opacité), JAMAIS une ombre portée lourde.
        ...(shadow ? { shadowEnabled: true, shadowColor: '#000000', shadowOpacity: 38, shadowBlur: 12, shadowOffsetX: 0, shadowOffsetY: 0 } : {}),
      } as CanvasEl;
    });
    // Accents de marque (barres / soulignements)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const accentEls: CanvasEl[] = (Array.isArray(L?.accents) ? L.accents : []).filter((a: any) => a?.type).map((a: any, i: number) => ({
      id: `ai-accent-${i}`, type: 'rect',
      x: Math.max(0, Math.round(((a.xPct ?? 8) / 100) * stageW)),
      y: Math.max(0, Math.round(((a.yPct ?? 60) / 100) * stageH)),
      width: Math.max(6, Math.round((Math.min(Math.max(a.widthPct ?? 20, 2), 60) / 100) * stageW)),
      // Accents = traits FINS uniquement (jamais un pavé) : hauteur plafonnée à ~1.2% du cadre.
      height: Math.max(2, Math.round((Math.min(a.heightPct ?? (a.type === 'underline' ? 0.6 : 1), 1.2) / 100) * stageH)),
      rotation: 0, opacity: 100, fill: resolveColor(a.color), stroke: '', strokeWidth: 0, cornerRadius: 2,
    } as CanvasEl));
    // Logo (ratio réel préservé)
    const logoEls: CanvasEl[] = [];
    if (L?.logo?.show && workspaceData?.logo_url) {
      const logoSrc = `/api/proxy-image?url=${encodeURIComponent(workspaceData.logo_url)}`;
      const ratio = await new Promise<number>(res => { const i = new Image(); i.onload = () => res(i.naturalWidth / Math.max(1, i.naturalHeight)); i.onerror = () => res(3); i.src = logoSrc; });
      const w = Math.round((Math.min(Math.max(L.logo.widthPct ?? 18, 5), 50) / 100) * stageW);
      logoEls.push({ id: 'ai-logo', type: 'image', src: logoSrc,
        x: Math.max(0, Math.round(((L.logo.xPct ?? 6) / 100) * stageW)), y: Math.max(0, Math.round(((L.logo.yPct ?? 6) / 100) * stageH)),
        width: w, height: Math.max(8, Math.round(w / Math.max(0.2, ratio))), rotation: 0, opacity: 100 } as CanvasEl);
    }
    // Scrim global
    const extras: CanvasEl[] = [];
    const scrimPos = L?.scrim?.position;
    if (scrimPos === 'bottom' || scrimPos === 'top' || forceScrim) {
      const pos = (scrimPos === 'bottom' || scrimPos === 'top') ? scrimPos : 'bottom';
      const op = Math.max(22, Math.min(typeof L?.scrim?.opacity === 'number' ? L.scrim.opacity : 50, 65));
      extras.push({ id: 'scrim-overlay', type: 'rect', x: 0, y: 0, rotation: 0, opacity: op, width: stageW, height: stageH, fill: '#000000', stroke: '', strokeWidth: 0, cornerRadius: 0, scrim: pos } as CanvasEl);
    }
    // On retire les anciens éléments générés par l'IA (texte, scrim, accents,
    // logo, décor d'un template maison), on garde le reste. `ai-tpl-` manquait
    // ici : un décor choisi lors d'une génération précédente (aplat, forme)
    // restait accroché sous chaque régénération suivante, orphelin — aucun
    // panneau ne pouvait plus l'atteindre, puisqu'il n'appartient à aucun
    // texte. Signalé par Martin : un fond bleu impossible à retirer via
    // « Effet > Arrière-plan », qui ne contrôle que le texte sélectionné.
    const kept = elementsRef.current.filter(e => e.type !== 'text' && e.id !== 'scrim-overlay' && !e.id.startsWith('ai-accent') && e.id !== 'ai-logo' && !e.id.startsWith('ai-tpl-'));
    // La photo du post est un calque comme un autre — donc elle doit rester AU FOND
    // et le voile de lisibilité passer par-dessus elle. Empilé naïvement, le voile
    // se serait retrouvé sous la photo, donc invisible.
    const photoIdx = kept.findIndex(e => e.type === 'image' && e.x <= 1 && e.y <= 1
      && ((e as ImageEl).width ?? 0) >= stageW - 2 && ((e as ImageEl).height ?? 0) >= stageH - 2);
    // Passer d'une variante DESSINÉE à une variante simple effaçait la photo :
    // la composition dessinée l'avait posée sous un identifiant `ai-tpl-`, et le
    // ménage ci-dessus balaie précisément ces calques-là. On la remet donc quand
    // il n'en reste plus — une recette « texte sur photo » sans photo n'est plus
    // qu'un texte sur du vide.
    let photoLayers = photoIdx >= 0 ? [kept[photoIdx]] : [];
    // `proxyUrl` = la photo est déjà le FOND du plan de travail, elle s'affiche
    // sans calque : en rajouter un la doublerait.
    if (photoIdx < 0 && !proxyUrlRef.current) {
      const src = sourcePhotoDuPost();
      if (src) photoLayers = [photoLayer(src, stageW, stageH)];
    }
    const keptImgs = photoIdx >= 0 ? kept.filter((_, i) => i !== photoIdx) : kept;
    const combined = [...photoLayers, ...extras, ...keptImgs, ...accentEls, ...logoEls, ...newTextEls];
    await attendrePolices([displayFont, bodyFont]);
    applyElements(enforceDesignRules(relayoutText(combined, stageW, stageH), stageW, stageH));
  };

  // Compose : récupère l'univers du client + posts validés, demande 3 variantes, applique la 1re, puis QA.
  const composeWithAI = async (opts?: { chainQA?: boolean }): Promise<boolean> => {
    // Vrai dès que la composition retenue est un dessin complet : l'audit visuel
    // ne s'applique alors pas (cf. plus bas).
    let dessin = false;
    if (qaBusy) return false;
    const chainQA = opts?.chainQA !== false;
    setQaBusy(true); setQaMsg('Composition IA…');
    setEdAiLog([]);
    edLog('Lecture de la charte du client');
    let success = false;
    try {
      const texts = elementsRef.current.filter(e => e.type === 'text').map(e => (e as TextEl).text).filter(t => t && t.trim() && t !== 'VOTRE TEXTE');
      const FMT_DIMS: Record<string, [number, number]> = { 'ig-portrait': [420, 560], 'ig-square': [560, 560], 'ig-story': [315, 560], 'facebook': [560, 294] };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const summarizeZones = (zones: any[], fw: number, fh: number) => zones.filter(z => z?.type === 'text' && z.role).map(z => ({
        role: z.role, xPct: Math.round(((z.x ?? 0) / fw) * 100), yPct: Math.round(((z.y ?? 0) / fh) * 100),
        wPct: Math.round(((z.width ?? fw) / fw) * 100), fontPct: Math.round(((z.fontSize ?? 24) / fh) * 100), align: z.align ?? 'left', upper: !!z.uppercase,
      }));
      let styleRef: unknown[] = [];
      let approvedRef: unknown[] = [];
      try {
        const [{ data: tpls }, { data: approved }] = await Promise.all([
          supabase.from('post_templates').select('name, format_id, background_style, text_zones').eq('workspace_id', workspaceId).limit(6),
          supabase.from('posts').select('post_type, editor_json').eq('workspace_id', workspaceId).eq('approved_by_client', true).limit(4),
        ]);
        styleRef = (tpls ?? []).map(t => {
          const [fw, fh] = FMT_DIMS[t.format_id as string] ?? [420, 560];
          return { name: t.name, bg: (t.background_style as { type?: string } | null)?.type ?? 'none', blocks: summarizeZones(Array.isArray(t.text_zones) ? t.text_zones : [], fw, fh) };
        }).filter(s => s.blocks.length > 0).slice(0, 4);
        approvedRef = (approved ?? []).map(p => {
          const [fw, fh] = FMT_DIMS[(p.post_type as string) ? PT_FORMAT_MAP[p.post_type as string] : 'ig-portrait'] ?? [420, 560];
          let blocks: unknown[] = [];
          try { const j = JSON.parse(p.editor_json as string); const els = j?.slides?.[0]?.elements ?? []; blocks = summarizeZones(els, fw, fh); } catch { /* noop */ }
          return { blocks };
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }).filter((s: any) => s.blocks.length > 0).slice(0, 3);
      } catch { /* compose librement */ }
      edLog(`${styleRef.length} gabarit(s) et ${approvedRef.length} post(s) validé(s) en référence`);
      edLog(`${texts.length} bloc(s) de texte à placer`);
      edLog('Recherche de 3 compositions…');

      const res = await fetch('/api/compose-layout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: postPhotoUrl, format: { w: stageW, h: stageH },
          // Le serveur déduisait la présence d'une photo de l'URL qu'il reçoit.
          // Une photo importée à l'instant, ou posée en calque dans l'éditeur,
          // n'a pas encore d'URL publique : il concluait « pas de photo » et
          // remplaçait la zone par un aplat. C'est le client qui sait.
          hasPhoto: !!postPhotoUrl || elementsRef.current.some(e => e.type === 'image' && !!(e as ImageEl).src),
          // Le workspace part avec : le directeur artistique lit alors le secteur,
          // le ton et la typographie du client, au lieu de ne connaître que trois
          // couleurs et de composer à l'aveugle.
          workspaceId,
          brand: { primary: workspaceData?.primary_color, secondary: workspaceData?.secondary_color, accent: workspaceData?.accent_color, logo: !!workspaceData?.logo_url },
          blocks: texts, styleRef, approvedRef,
        }),
      });
      const data = await res.json();
      const layouts = Array.isArray(data.layouts) ? data.layouts : [];
      if (!res.ok || layouts.length === 0) { setQaMsg(data?.error ?? 'Composition échouée'); return false; }
      // Le parti pris que l'IA s'est donné avant de choisir : on le montre, sinon
      // rien ne distingue une composition pensée d'un tirage au sort.
      const refs = data?.refs as { instagram?: number } | undefined;
      if (refs?.instagram) edLog(`${refs.instagram} visuel(s) du compte Instagram en référence de style`);
      if (typeof data?.rationale === 'string' && data.rationale.trim()) edLog(`Parti pris : ${data.rationale.trim()}`);
      // QUELLE COMPOSITION, ET SUR QUELLE IDENTITÉ.
      //
      // Le journal disait ce que l'IA avait COMPRIS, jamais ce qu'elle avait
      // CHOISI. Quand un visuel déplaît, personne — ni l'utilisateur, ni nous —
      // ne peut dire quelle recette l'a produit : on rejuge la bibliothèque
      // entière à l'aveugle. Le nom se lit comme un nom de modèle, l'identifiant
      // entre parenthèses est ce qu'on nous rapporte pour aller droit au dessin.
      const typo = data?.typo as { name?: string } | undefined;
      const terrain = data?.terrain as { name?: string } | undefined;
      if (typo?.name || terrain?.name) {
        edLog(`Identité : ${[typo?.name, terrain?.name].filter(Boolean).join(' · ')}`);
      }
      edLog(`${layouts.length} composition(s) proposée(s) — application de la 1re`);
      edLog(nomDeComposition(layouts[0]));
      setAiVariants(layouts); setAiVariantIdx(0); setVariantAsked(layouts.length > 1);
      // Ce qui est APPLIQUÉ compte, pas seulement ce qui est changé : sans cette
      // trace, le compositeur n'a aucun moyen de savoir qu'il vient de servir
      // cette composition, et il la resert au post suivant.
      rememberChoice(layouts[0], 1);
      await materializeLayout(layouts[0]);
      // Une composition DESSINÉE (template maison ou système de design) ne doit
      // pas passer devant l'audit visuel : celui-ci raisonne en « texte posé sur
      // une photo » — il écarte les blocs qui se chevauchent, retire les aplats
      // de couleur derrière le texte, réaligne tout. Sur un dessin, ces règles
      // défont exactement ce qui en fait un visuel de marque.
      dessin = !!layouts[0]?.template;
      setQaMsg(layouts.length > 1 ? `Composé ✓ (1/${layouts.length})` : 'Composé ✓');
      success = true;
    } catch {
      setQaMsg('Erreur composition');
    } finally {
      setQaBusy(false);
      if (!(success && chainQA)) setTimeout(() => setQaMsg(null), 2800);
    }
    // L'audit visuel est ATTENDU, pas lancé dans le vide : composer puis relire
    // est une seule opération. Lancé en arrière-plan, il retouchait le visuel
    // après que l'appelant se croyait fini — et l'auto-save pouvait enregistrer
    // entre les deux.
    if (success && chainQA && !dessin) {
      await new Promise<void>(r => setTimeout(r, 350)); // laisse le canvas peindre la composition
      try { await runVisualQA(); } catch { /* l'audit est un plus, jamais un blocage */ }
    }
    return success;
  };

  // Le choix d'une variante est la SEULE préférence observée qu'on puisse
  // recueillir sans déranger : on l'enregistre pour que le compositeur privilégie
  // ensuite ce que ce client garde vraiment. Silencieux de bout en bout — un avis
  // perdu ne doit jamais interrompre le travail.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rememberChoice = (variant: any, rank: number) => {
    const recipeId = typeof variant?.recipeId === 'string' ? variant.recipeId : '';
    if (!recipeId || isTemplate) return;
    void fetch('/api/layout-feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId, postId: isTemplate ? null : entityId,
        recipeId, source: variant?.source === 'template' ? 'template' : 'library',
        variant: rank,
      }),
    }).catch(() => { /* sans effet sur l'édition en cours */ });
  };

  // Sélectionne une variante précise (pastilles 1·2·3).
  const selectVariant = async (idx: number) => {
    if (qaBusy || idx < 0 || idx >= aiVariants.length || idx === aiVariantIdx) return;
    setAiVariantIdx(idx);
    rememberChoice(aiVariants[idx], idx + 1);
    setVariantAsked(false);
    setQaBusy(true); setQaMsg(`Variante ${idx + 1}/${aiVariants.length}…`);
    try { await materializeLayout(aiVariants[idx]); edLog(nomDeComposition(aiVariants[idx])); setQaMsg(`Variante ${idx + 1} ✓`); }
    catch { setQaMsg('Erreur variante'); }
    finally { setQaBusy(false); setTimeout(() => setQaMsg(null), 2000); }
  };

  // Auto-composition à l'ouverture d'un post vierge, avec overlay de chargement.
  useEffect(() => {
    if (dataLoading || autoComposeDoneRef.current || !autoComposeReady) return;
    autoComposeDoneRef.current = true;
    (async () => {
      setAiBuilding(true);
      // L'auto-save se tait pendant la composition. Sans ça, il enregistrait le
      // bloc de secours 1,5 s après l'ouverture : le post cessait d'être vierge,
      // l'auto-composition ne se relançait plus jamais, et on retrouvait ce bloc
      // brut à chaque réouverture en croyant que c'était le travail de l'IA.
      busyWithSlidesRef.current = true;
      let ok = false;
      // `chainQA` enchaîne l'audit visuel : le moteur RE-REGARDE le visuel qu'il
      // vient de produire — l'image, pas ses propres intentions — et corrige ce
      // qui cloche. Il ne tournait qu'au clic manuel : l'auto-composition livrait
      // donc un premier jet jamais relu, alors qu'un graphiste regarde toujours
      // son écran avant de rendre.
      try { ok = await composeWithAI({ chainQA: true }); } catch { /* le toast a déjà parlé */ }
      // L'audit s'enchaîne juste après, en tâche de fond : on ne relâche le
      // verrou d'auto-save qu'une fois qu'il a fini de retoucher.
      busyWithSlidesRef.current = false;
      setAiBuilding(false);
      // Un échec doit se voir : sinon le bloc de secours passe pour une proposition.
      if (!ok) showEditorToast('La composition automatique n’a pas abouti — relancez « Composer (IA) ».');
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataLoading, autoComposeReady]);

  // Carrousel écrit à l'ouverture, à partir du sujet du Composer.
  useEffect(() => {
    if (dataLoading || autoCarouselDoneRef.current || !autoCarouselBrief) return;
    autoCarouselDoneRef.current = true;
    (async () => {
      setAiBuilding(true);
      try { await generateCarousel(autoCarouselBrief, 6); } catch { /* le toast de generateCarousel a déjà parlé */ }
      setAiBuilding(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataLoading, autoCarouselBrief]);

  const deletePost = async () => {
    if (!confirm("Supprimer ce post ? Cette action est irréversible.")) return;
    await supabase.from('posts').delete().eq('id', postId);
    window.location.href = `/workspace/${workspaceId}`;
  };

  // ── Enregistrement d'un TEMPLATE (mode template) ──────────────────────────
  const handleSaveTemplate = async () => {
    if (!stageRef.current) return;
    setSaving(true);
    setSelectedId(null);
    setSelectedIds([]);
    await new Promise(resolve => setTimeout(resolve, 200));
    saveCurrentSlide();
    const els = elementsRef.current;
    // La miniature doit montrer la PREMIÈRE page, pas celle qu'on regardait au
    // moment d'enregistrer — sinon un template de carrousel se présente par sa
    // page 3 dans la bibliothèque.
    if (activeSlideIdx !== 0 && slidesRef.current[0]) {
      const first = slidesRef.current[0];
      setElements(first.elements);
      elementsRef.current = first.elements;
      setProxyUrl(first.proxyUrl);
      proxyUrlRef.current = first.proxyUrl;
      setActiveSlideIdx(0);
      await new Promise(resolve => setTimeout(resolve, 350));
    }
    // Miniature du template
    let thumbnailUrl: string | null = null;
    try {
      const dataURL = stageRef.current.toDataURL({ pixelRatio: 1 });
      const blob = await fetch(dataURL).then(r => r.blob());
      const fn = `${workspaceId}/templates/${entityId}-${Date.now()}.png`;
      await supabase.storage.from('photos').upload(fn, blob, { contentType: 'image/png', upsert: true });
      const { data: ud } = supabase.storage.from('photos').getPublicUrl(fn);
      thumbnailUrl = ud?.publicUrl || null;
    } catch {}
    // logo_placement dérivé d'une image non-placeholder (le logo posé sur le canvas)
    const logoEl = els.find(e => e.type === 'image' && (e as ImageEl).src !== PHOTO_PLACEHOLDER_SRC) as ImageEl | undefined;
    const logo_placement = logoEl ? { x: logoEl.x, y: logoEl.y, width: logoEl.width, height: logoEl.height } : null;
    const body = {
      workspace_id: workspaceId,
      name: templateName || 'Nouveau template',
      format_id: formatId,
      background_style: bgStyle ?? { type: 'gradient', colorFrom: '#0038FF', colorTo: '#FFFFFF', angle: 135 },
      // Première page en `text_zones` (compatibilité), template complet en `pages` :
      // un template peut décrire un carrousel entier, page par page.
      text_zones: slidesRef.current[0]?.elements ?? els,
      pages: slidesRef.current.map(s => ({ elements: s.elements })),
      logo_placement,
      thumbnail_url: thumbnailUrl,
    };
    const isNew = !templateId || templateId === 'new';
    const res = await fetch(isNew ? '/api/templates' : `/api/templates/${templateId}`, {
      method: isNew ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (res.ok) {
      window.location.href = `/workspace/${workspaceId}/templates`;
    } else {
      showEditorToast(T('templateSaveFailed'));
    }
  };

  // Cmd+S passe par ici (cf. raccourcis clavier).
  const handleSave = async () => {
    if (isTemplate) { await handleSaveTemplate(); return; }
    if (!stageRef.current) return;
    // L'export photographie chaque page à tour de rôle : l'auto-save doit se
    // taire jusqu'au bout, sinon il enregistre un état intermédiaire du défilé.
    busyWithSlidesRef.current = true;
    setSaving(true);
    setSelectedId(null);
    setSelectedIds([]);
    await new Promise(resolve => setTimeout(resolve, 200));

    // Flush current slide
    saveCurrentSlide();

    // Carrousel = plusieurs pages, quel que soit le type déclaré. Il n'y a plus de
    // case « carrousel » à cocher en amont : l'export suit ce qui est dessiné.
    const totalSlides = slidesRef.current.length;
    const isCarousel = canBeCarousel && (totalSlides > 1 || isContinuous);
    const carouselUrls: string[] = [];

    const uploadCurrent = async (idx: number): Promise<string> => {
      const dataURL = stageRef.current!.toDataURL({ pixelRatio: 2 });
      const blob = await fetch(dataURL).then(r => r.blob());
      const fn = `${workspaceId}/${entityId}-slide${idx}-${Date.now()}.png`;
      await supabase.storage.from('exports').upload(fn, blob, { contentType: 'image/png', upsert: true });
      const { data: ud } = supabase.storage.from('exports').getPublicUrl(fn);
      return ud?.publicUrl || '';
    };

    if (isCarousel && isContinuous) {
      // Carrousel continu : la toile large est déjà rendue à l'écran. On la
      // découpe en `contPanels` régions de stageW via l'export de zone de Konva
      // (toDataURL {x,y,width,height}) → une slide Instagram par volet.
      for (let i = 0; i < contPanels; i++) {
        const dataURL = stageRef.current!.toDataURL({ x: i * stageW, y: 0, width: stageW, height: stageH, pixelRatio: 2 });
        const blob = await fetch(dataURL).then(r => r.blob());
        const fn = `${workspaceId}/${entityId}-slide${i}-${Date.now()}.png`;
        await supabase.storage.from('exports').upload(fn, blob, { contentType: 'image/png', upsert: true });
        const { data: ud } = supabase.storage.from('exports').getPublicUrl(fn);
        carouselUrls.push(ud?.publicUrl || '');
      }
    } else if (isCarousel && totalSlides > 1) {
      const origIdx = activeSlideIdx;
      // On rend CHAQUE slide avant de la capturer — sans exception. L'ancienne
      // optimisation (« ne pas re-rendre si i === slide active ») était buguée :
      // après la 1re itération le stage n'affiche plus la slide active, donc sa
      // capture reprenait la dernière slide rendue → carrousel avec toutes les
      // slides identiques.
      for (let i = 0; i < totalSlides; i++) {
        const s = slidesRef.current[i];
        setElements(s.elements);
        elementsRef.current = s.elements;
        setProxyUrl(s.proxyUrl);
        proxyUrlRef.current = s.proxyUrl;
        setBgOffsetX(s.bgOffsetX ?? 0);
        bgOffsetXRef.current = s.bgOffsetX ?? 0;
        setBgOffsetY(s.bgOffsetY ?? 0);
        bgOffsetYRef.current = s.bgOffsetY ?? 0;
        await new Promise(resolve => setTimeout(resolve, 450));
        const url = await uploadCurrent(i);
        carouselUrls.push(url);
      }
      // Restore original slide
      const orig = slidesRef.current[origIdx];
      setElements(orig.elements);
      elementsRef.current = orig.elements;
      setProxyUrl(orig.proxyUrl);
      proxyUrlRef.current = orig.proxyUrl;
      setBgOffsetX(orig.bgOffsetX ?? 0);
      bgOffsetXRef.current = orig.bgOffsetX ?? 0;
      setBgOffsetY(orig.bgOffsetY ?? 0);
      bgOffsetYRef.current = orig.bgOffsetY ?? 0;
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // Export cover (active slide) for calendar / feed previews.
    // En continu, on ne capture que le 1er volet (sinon on aurait une image large).
    const coverDataURL = stageRef.current.toDataURL(isContinuous ? { x: 0, y: 0, width: stageW, height: stageH, pixelRatio: 2 } : { pixelRatio: 2 });
    const coverBlob = await fetch(coverDataURL).then(r => r.blob());
    const coverFn = `${workspaceId}/${entityId}-${Date.now()}.png`;
    await supabase.storage.from('exports').upload(coverFn, coverBlob, { contentType: 'image/png', upsert: true });
    const { data: coverUrl } = supabase.storage.from('exports').getPublicUrl(coverFn);

    const textEl = elements.find(e => e.type === 'text') as TextEl | undefined;
    const allSlides = slidesRef.current;

    await supabase.from('posts').update({
      status: 'validated',
      exported_image_url: isCarousel && carouselUrls.length > 0 ? carouselUrls[0] : (coverUrl?.publicUrl || ''),
      editor_json: JSON.stringify({
        version: 2,
        formatId,
        slides: allSlides,
        ...(isContinuous ? { carouselContinuous: true, contPanels } : {}),
        ...(isCarousel && carouselUrls.length > 0 ? { carousel_urls: carouselUrls } : {}),
      }),
      texte_visuel: textEl?.text || '',
      ...(aiCaption ? { caption_final: aiCaption, caption_was_edited: captionEdited } : {}),
    }).eq('id', postId);
    // Tout est écrit : l'auto-save peut reprendre (la page va changer, mais si la
    // redirection est empêchée on ne reste pas bloqué sans sauvegarde).
    busyWithSlidesRef.current = false;
    window.location.href = `/workspace/${workspaceId}/planning`;
  };

  handleSaveRef.current = handleSave;

  // ── Post type change — updates format + clamps elements + saves to DB ───────

  const changePostType = async (newType: 'post' | 'reel' | 'story' | 'carrousel') => {
    const TYPE_FORMAT: Record<string, string> = { post: 'ig-portrait', reel: 'ig-story', story: 'ig-story', carrousel: 'ig-square' };
    const newFormatId = TYPE_FORMAT[newType];
    if (newType === 'story' && formatId !== 'ig-story' && elements.length > 0) {
      setPendingStoryType('story');
      setShowStoryWarn(true);
      return;
    }
    const newFmt = FORMATS.find(f => f.id === newFormatId) ?? FORMATS[0];
    setPostType(newType);
    setFormatId(newFormatId);
    // Réadapte le texte au nouveau format : clamp + auto-fit + anti-chevauchement.
    const clamped = elementsRef.current.map(el => ({
      ...el,
      x: Math.min(el.x, newFmt.w - 20),
      y: Math.min(el.y, newFmt.h - 20),
    }));
    const relaid = relayoutText(clamped, newFmt.w, newFmt.h);
    setElements(relaid);
    elementsRef.current = relaid;
    await supabase.from('posts').update({ post_type: newType }).eq('id', postId);
  };

  // ── Magic Resize — génère des posts séparés adaptés aux 2 autres formats ────
  // (mapping restreint à ig-portrait/ig-square/ig-story : le format 'facebook'
  // n'a pas de post_type de retour propre via PT_FORMAT_MAP, cf. remap ci-dessus)

  const magicResize = async () => {
    if (resizing) return;
    const targets = MAGIC_RESIZE_TARGETS.filter(t => t.formatId !== formatId);
    if (!targets.length) { showEditorToast(T('noOtherFormat')); return; }
    const currentElements = elementsRef.current;
    if (!currentElements.length && !proxyUrl) { showEditorToast(T('addContentFirst')); return; }
    setResizing(true);
    try {
      let natW = 0, natH = 0;
      if (proxyUrl) {
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error('load')); img.src = proxyUrl; });
          natW = img.naturalWidth; natH = img.naturalHeight;
        } catch { /* pas de recadrage de fond possible, on garde 0/0 */ }
      }
      const { data: srcPost } = await supabase.from('posts').select('brief, description').eq('id', postId).single();
      let created = 0;
      for (const target of targets) {
        const fmt = FORMATS.find(f => f.id === target.formatId);
        if (!fmt) continue;
        const remapped = remapElementsToFormat(currentElements, stageW, stageH, fmt.w, fmt.h);
        const relaid = relayoutText(remapped, fmt.w, fmt.h);
        let bgOX = 0, bgOY = 0;
        if (proxyUrl && natW && natH) {
          const scale = Math.max(fmt.w / natW, fmt.h / natH);
          bgOX = (fmt.w - natW * scale) / 2;
          bgOY = (fmt.h - natH * scale) / 2;
        }
        const textEl = relaid.find((e: CanvasEl) => e.type === 'text') as TextEl | undefined;
        const editorJson = JSON.stringify({
          version: 2,
          slides: [{ id: 'slide-1', elements: relaid, proxyUrl, bgOffsetX: bgOX, bgOffsetY: bgOY }],
        });
        const { error } = await supabase.from('posts').insert({
          workspace_id: workspaceId,
          photo_url: postPhotoUrl,
          brief: srcPost?.brief ?? '',
          description: srcPost?.description ?? '',
          texte_visuel: textEl?.text || '',
          status: 'validated',
          post_type: target.postType,
          editor_json: editorJson,
        });
        if (!error) created++;
      }
      showEditorToast(created > 0 ? T('formatsGenerated', { count: created }) : T('formatsFailed'));
    } finally {
      setResizing(false);
    }
  };

  // ── Font upload ───────────────────────────────────────────────────────────

  const handleFontUpload = async (file: File): Promise<string> => {
    const fontName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9]/g, '-');
    const arrayBuffer = await file.arrayBuffer();
    const fontFace = new FontFace(fontName, arrayBuffer);
    await fontFace.load();
    document.fonts.add(fontFace);
    const fileName = `fonts/${workspaceId}/${file.name}`;
    await supabase.storage.from('exports').upload(fileName, file, { upsert: true });
    const { data: urlData } = supabase.storage.from('exports').getPublicUrl(fileName);
    const newFont = { name: fontName, url: urlData.publicUrl };
    setCustomFonts(prev => {
      const updated = [...prev, newFont];
      supabase.from('workspaces').update({ custom_fonts: JSON.stringify(updated) }).eq('id', workspaceId);
      return updated;
    });
    return fontName;
  };

  // ── Templates ─────────────────────────────────────────────────────────────

  const applyTemplate = (overrides: Partial<TextEl>) => {
    const el: TextEl = { id: newId(), type: 'text', x: 20, y: 200, rotation: 0, opacity: 100, text: 'VOTRE TEXTE', fontSize: 36, fontFamily: 'Oswald', fontStyle: 'bold', textDecoration: '', fill: '#ffffff', align: 'center', width: 560, hasBg: true, bgColor: '#0038FF', bgOpacity: 95, cornerRadius: 4, padding: 16, paddingH: 16, paddingV: 10, ...overrides };
    applyElements([...elements, el]);
    setSelectedId(el.id);
  };

  const TEMPLATES = [
    { label: 'Bloc couleur', overrides: { hasBg: true, bgColor: '#0038FF', bgOpacity: 100, fill: '#fff', fontStyle: 'bold', fontSize: 40 } },
    { label: 'Texte blanc bold', overrides: { hasBg: false, fill: '#ffffff', fontStyle: 'bold', fontSize: 56, opacity: 100 } },
    { label: 'Semi-transparent', overrides: { hasBg: true, bgColor: '#000000', bgOpacity: 65, fill: '#ffffff', fontSize: 38, cornerRadius: 0 } },
    { label: 'Badge arrondi', overrides: { hasBg: true, bgColor: '#B8F028', bgOpacity: 100, fill: '#000000', cornerRadius: 40, padding: 18, fontSize: 28, width: 300 } },
  ];

  // 4D — Multi-block layout templates (inserts several role-tagged text elements)
  // ── AI generation ─────────────────────────────────────────────────────────

  const generateAI = async () => {
    if (aiTimerRef.current) clearInterval(aiTimerRef.current);
    setAiTyping(true); setAiCaption(''); setCaptionEdited(false);
    try {
      // ── 5A: collect template zones (ID-keyed, with size info for char limits) ─
      const templateZones = elementsRef.current
        .filter(el => el.type === 'text' && (el as TextEl).role)
        .map(el => {
          const t = el as TextEl;
          const pH = t.paddingH ?? t.padding ?? 12;
          const pV = t.paddingV ?? t.padding ?? 8;
          return {
            id: t.id,
            role: t.role,
            // Nom donné au champ par l'auteur du template (rôle personnalisé).
            roleLabel: t.roleLabel || undefined,
            roleHint: t.roleHint || undefined,
            width: Math.max(t.width ?? 200, 1),
            height: Math.max(t.fontSize + pV * 2, 1),
            fontSize: Math.max(t.fontSize, 1),
          };
        });

      // ── 4D (legacy): role-name map — used only when no template zones ─────────
      const textRoles: Record<string, string> = {};
      if (templateZones.length === 0) {
        elementsRef.current.forEach(el => {
          if (el.type === 'text' && (el as TextEl).role) textRoles[(el as TextEl).role!] = (el as TextEl).text;
        });
      }

      // 5C — fetch last approved captions for this workspace (brand memory)
      const { data: recentPosts } = await supabase
        .from('posts')
        .select('caption_final')
        .eq('workspace_id', workspaceId)
        .eq('caption_was_edited', true)
        .not('caption_final', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(3);
      const approvedCaptions = (recentPosts ?? []).map((p: { caption_final: string | null }) => p.caption_final).filter(Boolean) as string[];

      const res = await fetch('/api/generate-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brief: `Post Instagram pour ${workspaceName}`,
          photoUrl: postPhotoUrl,
          workspaceName,
          // Brand identity — le ton vient TOUJOURS de la charte (plus de ton forcé côté UI)
          sector: workspaceData?.sector,
          brandTone: workspaceData?.tone,
          companyDescription: workspaceData?.company_description,
          // Voice rules
          brandVoicePrompt: workspaceData?.brand_voice_prompt,
          wordsToUse: workspaceData?.words_to_use,
          wordsToAvoid: workspaceData?.words_to_avoid,
          captionExamples: workspaceData?.caption_examples,
          descriptionStyle: workspaceData?.description_style,
          // 5A — template zones with dimensions (replaces role-name map when present)
          templateZones: templateZones.length > 0 ? templateZones : undefined,
          // 4D — legacy role-name map (only sent when no template zones)
          textRoles: Object.keys(textRoles).length > 0 ? textRoles : undefined,
          // 5B — post context
          context: postContext.trim() || undefined,
          // 5C — approved captions for memory
          approvedCaptions: approvedCaptions.length > 0 ? approvedCaptions : undefined,
        }),
      });
      const data = await res.json();

      // ── 5A: apply zone_blocks by element ID (primary — template mode) ─────────
      if (data.zoneBlocks && typeof data.zoneBlocks === 'object') {
        const newEls = elementsRef.current.map(el => {
          if (el.type === 'text') {
            const generated = (data.zoneBlocks as Record<string, string>)[el.id];
            if (generated) return { ...el, text: generated } as TextEl;
          }
          return el;
        });
        applyElements(newEls, false);
      }

      // ── 4D: apply blocks by role name (fallback — no-template mode) ──────────
      if (!data.zoneBlocks && data.blocks && typeof data.blocks === 'object') {
        const newEls = elementsRef.current.map(el => {
          if (el.type === 'text' && (el as TextEl).role) {
            const generated = (data.blocks as Record<string, string>)[(el as TextEl).role!];
            if (generated) return { ...el, text: generated } as TextEl;
          }
          return el;
        });
        applyElements(newEls, false);
      }

      const text: string = data?.description || data?.texte_visuel || '';
      let i = 0;
      aiTimerRef.current = setInterval(() => {
        i += 3; setAiCaption(text.slice(0, i));
        if (i >= text.length) { if (aiTimerRef.current) clearInterval(aiTimerRef.current); setAiTyping(false); }
      }, 14);
    } catch { setAiTyping(false); }
  };

  const canUndo = histIdxRef.current > 0;
  const canRedo = histIdxRef.current < historyRef.current.length - 1;
  void histTick;

  // ── Loading / error states ─────────────────────────────────────────────────

  if (dataLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--canvas)', flexDirection: 'column', gap: 16 }}>
      <svg style={{ width: 24, height: 24, color: 'var(--ink-3)', animation: 'spin 1s linear infinite' }} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeOpacity="0.25"/>
        <path fill="currentColor" fillOpacity="0.75" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/>
      </svg>
      <span style={{ fontSize: 13, color: 'var(--ink-3)', fontFamily: 'var(--sans)' }}>{T('loadingEditor')}</span>
    </div>
  );

  if (loadError) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--canvas)', flexDirection: 'column', gap: 16 }}>
      <p style={{ fontSize: 14, color: 'var(--warn)', fontFamily: 'var(--sans)' }}>{loadError}</p>
      <button onClick={() => window.location.reload()} className="btn btn-primary">
        Réessayer
      </button>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {sidebarOpen && <Sidebar bare />}

      {/* ── Menu contextuel (clic droit sur un élément, façon Canva) ── */}
      {ctxMenu && (() => {
        const el = elements.find(e => e.id === ctxMenu.id);
        if (!el) return null;
        const locked = lockedIds.has(el.id);
        const close = () => setCtxMenu(null);
        const item = (label: string, shortcut: string, onClick: () => void, danger?: boolean) => (
          <button key={label} onClick={() => { onClick(); close(); }}
            style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '8px 14px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: danger ? '#C4452F' : 'var(--ink)', textAlign: 'left', whiteSpace: 'nowrap' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--sunk)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <span style={{ flex: 1 }}>{label}</span>
            {shortcut && <span style={{ fontSize: 11.5, color: 'var(--ink-3)', fontFamily: 'var(--mono)' }}>{shortcut}</span>}
          </button>
        );
        const sep = (k: string) => <div key={k} style={{ height: 1, background: 'var(--line)', margin: '5px 0' }} />;
        const MENU_W = 232;
        const left = Math.min(ctxMenu.x, window.innerWidth - MENU_W - 8);
        const top = Math.min(ctxMenu.y, window.innerHeight - 380);
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 300 }} onMouseDown={close} onContextMenu={e => { e.preventDefault(); close(); }}>
            <div className="pop-in" onMouseDown={e => e.stopPropagation()}
              style={{ position: 'fixed', left, top: Math.max(8, top), width: MENU_W, background: '#fff', borderRadius: 12, padding: '6px 0', boxShadow: '0 16px 44px -12px rgba(13,15,10,.4), 0 0 0 1px rgba(13,15,10,.06)' }}>
              {item('Copier', 'Ctrl+C', () => copyEl(el.id))}
              {item('Coller', 'Ctrl+V', () => pasteEl())}
              {item('Dupliquer', 'Ctrl+D', () => { setSelectedId(el.id); duplicateEl(); })}
              {item('Supprimer', 'Suppr', () => deleteEl(el.id), true)}
              {sep('s1')}
              {item('Vers l\u2019avant', '', () => { setSelectedId(el.id); layerAction('forward'); })}
              {item('Vers l\u2019arrière', '', () => { setSelectedId(el.id); layerAction('backward'); })}
              {item('Mettre au premier plan', '', () => { setSelectedId(el.id); layerAction('front'); })}
              {item('Mettre à l\u2019arrière-plan', '', () => { setSelectedId(el.id); layerAction('back'); })}
              {sep('s2')}
              {item(locked ? 'Déverrouiller' : 'Verrouiller', '', () => toggleLocked(el.id))}
            </div>
          </div>
        );
      })()}

      {/* ── Editor toast ── */}
      {editorToast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 200, padding: '11px 22px', borderRadius: 99, fontWeight: 700, fontSize: 13, background: 'var(--warn)', color: '#fff', boxShadow: '0 8px 24px rgba(13,15,10,.3)', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
          {editorToast}
        </div>
      )}

      {/* ── Bandeau : visuel rouvert dans un autre format que celui d'origine ── */}
      {formatChangedFrom && (
        <div style={{ position: 'fixed', top: 74, left: '50%', transform: 'translateX(-50%)', zIndex: 190, maxWidth: 520, display: 'flex', gap: 11, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 12, background: 'var(--cream, #fff)', border: '1px solid #C8732B55', boxShadow: '0 12px 32px -12px rgba(13,15,10,.35)' }}>
          <span style={{ color: '#C8732B', flexShrink: 0, marginTop: 1, display: 'grid' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></svg>
          </span>
          <div style={{ minWidth: 0, fontFamily: 'var(--sans)' }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: 'var(--ink)' }}>
              Format adapté : {formatChangedFrom.from} → {formatChangedFrom.to}
            </p>
            <p style={{ margin: '3px 0 0', fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.45 }}>
              Le type de ce post a changé depuis la programmation. Les éléments ont été repositionnés au prorata du nouveau cadre — vérifie que la composition te convient avant d&apos;enregistrer.
            </p>
          </div>
          <button onClick={() => setFormatChangedFrom(null)} title="Fermer"
            style={{ marginLeft: 'auto', flexShrink: 0, width: 24, height: 24, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ink-3)', display: 'grid', placeItems: 'center', borderRadius: 6 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      )}

      {/* ── Story format warning modal ── */}
      {showStoryWarn && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(13,15,10,.45)' }} onClick={() => { setShowStoryWarn(false); setPendingStoryType(null); }}>
          <div className="card" style={{ padding: 28, maxWidth: 380, width: '100%', margin: '0 16px' }} onClick={e => e.stopPropagation()}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(200,115,43,.12)', display: 'grid', placeItems: 'center', marginBottom: 16 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--warn)" strokeWidth="2" strokeLinecap="round"><path d="M10.3 3.4 2.7 17A2 2 0 0 0 4.4 20h15.2a2 2 0 0 0 1.7-3L13.7 3.4a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></svg>
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)', marginBottom: 8 }}>{T('changeFormat')}</h3>
            <p style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.55, marginBottom: 22 }}>
              Passer en format Story (9:16) va adapter le cadre de votre visuel. Des éléments peuvent dépasser le cadre et nécessiter des ajustements.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setShowStoryWarn(false); setPendingStoryType(null); }} className="btn btn-ghost" style={{ flex: 1 }}>{T('cancel')}</button>
              <button onClick={async () => {
                setShowStoryWarn(false);
                if (pendingStoryType) {
                  const TYPE_FORMAT: Record<string, string> = { post: 'ig-portrait', reel: 'ig-story', story: 'ig-story', carrousel: 'ig-square' };
                  const newFormatId = TYPE_FORMAT[pendingStoryType];
                  const newFmt = FORMATS.find(f => f.id === newFormatId) ?? FORMATS[0];
                  setPostType(pendingStoryType);
                  setFormatId(newFormatId);
                  const clamped = elementsRef.current.map(el => ({ ...el, x: Math.min(el.x, newFmt.w - 20), y: Math.min(el.y, newFmt.h - 20) }));
                  const relaid = relayoutText(clamped, newFmt.w, newFmt.h);
                  setElements(relaid);
                  elementsRef.current = relaid;
                  await supabase.from('posts').update({ post_type: pendingStoryType }).eq('id', postId);
                }
                setPendingStoryType(null);
              }} className="btn btn-primary" style={{ flex: 1 }}>{T('continue')}</button>
            </div>
          </div>
        </div>
      )}

    {/* Le plan de travail est une feuille posée sur le fond, comme le reste de
        l'app : arrondie en haut, marge à gauche du rail. Replier le rail la
        fait glisser en plein écran — la marge, les arrondis et la hauteur
        s'animent ensemble, si bien qu'on voit le cadre s'ouvrir puis se
        refermer au lieu d'un changement sec. */}
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: sidebarOpen ? 'calc(100vh - 10px)' : '100vh',
      marginTop: sidebarOpen ? 10 : 0,
      marginLeft: sidebarOpen ? 'calc(var(--sb-w) + 10px)' : 0,
      borderRadius: sidebarOpen ? '22px 22px 0 0' : 0,
      boxShadow: sidebarOpen ? '-30px 0 70px -40px rgba(0,0,0,.72), 0 0 0 1px rgba(255,255,255,.08)' : 'none',
      fontFamily: 'var(--sans)',
      background: 'radial-gradient(120% 80% at 50% -10%, #FBFAF4, #ECEBE1 70%)',
      overflow: 'hidden',
      transition: 'margin .34s cubic-bezier(.22,1,.36,1), height .34s cubic-bezier(.22,1,.36,1), border-radius .34s cubic-bezier(.22,1,.36,1), box-shadow .34s',
    }}>

      {/* ── TOPBAR ── */}
      <div data-stop-deselect className={`ed-topbar${sidebarOpen ? ' ed-narrow' : ''}`} style={{
        minHeight: 52, flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px',
        // Bandeau vert dégradé (façon en-tête sombre Canva) — tous les enfants
        // basculent en clair via ces overrides de tokens (scopés à la topbar).
        background: 'linear-gradient(115deg, var(--forest) 0%, var(--forest-2) 55%, var(--forest-3) 100%)',
        ['--ink' as string]: '#F1F0E8',
        ['--ink-2' as string]: 'rgba(241,240,232,.72)',
        ['--ink-3' as string]: 'rgba(241,240,232,.52)',
        ['--line' as string]: 'rgba(255,255,255,.16)',
        ['--sunk' as string]: 'rgba(255,255,255,.10)',
        ['--btn-soft' as string]: 'rgba(255,255,255,.13)',
        ['--btn-soft-2' as string]: 'rgba(255,255,255,.22)',
        ['--canvas' as string]: 'rgba(255,255,255,.16)',
        ['--paper' as string]: 'rgba(255,255,255,.10)',
        position: 'relative', zIndex: 30,
      }}>
        {/* Left: burger + back + workspace label + undo/redo */}
        <div className="ed-topbar-left" style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <button onClick={toggleSidebar} title={sidebarOpen ? 'Masquer la sidebar' : 'Afficher la sidebar'}
            className="btn btn-sm btn-ghost btn-icon" style={{ flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <a href={isTemplate ? `/workspace/${workspaceId}/templates` : `/workspace/${workspaceId}`} className="btn btn-sm btn-ghost"
            style={{ gap: 5, textDecoration: 'none', flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6"/></svg>
            <span className="ed-hide-sm">{isTemplate ? 'Templates' : 'Retour'}</span>
          </a>
          <span className="ed-hide-sm" style={{ width: 1, height: 24, background: 'var(--line)', flexShrink: 0 }} />
          <div className="ed-hide-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 24, height: 24, borderRadius: 7, background: 'var(--leaf)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <span style={{ fontFamily: 'var(--display)', fontWeight: 900, fontSize: 10, color: '#06281C', letterSpacing: '-0.02em' }}>
                {workspaceName ? workspaceName.slice(0,2).toUpperCase() : 'KL'}
              </span>
            </div>
            {isTemplate ? (
              <input value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder={T('templateName')}
                style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)', border: '1px solid var(--line)', borderRadius: 'var(--r-s)', padding: '4px 8px', outline: 'none', fontFamily: 'var(--sans)', background: 'var(--sunk)', maxWidth: 180 }} />
            ) : (
              <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>{workspaceName || 'Éditeur'}</span>
            )}
            <span className="chip" style={{ background: 'var(--sunk)', color: 'var(--ink-2)', fontSize: 10.5 }}>
              {isTemplate ? `Template · ${activeFormat.label}` : `${activeFormat.label}${slides.length > 1 ? ` · ${slides.length} slides` : ''}`}
            </span>
          </div>
          <span style={{ width: 1, height: 24, background: 'var(--line)', flexShrink: 0 }} />
          <button onClick={undo} disabled={!canUndo} title={T('undo')} className="ed-hbtn"
            style={{ opacity: canUndo ? 1 : 0.3 }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 7L4 12l5 5M4 12h11a5 5 0 0 1 0 10h-1"/></svg>
          </button>
          <button onClick={redo} disabled={!canRedo} title={T('redo')} className="ed-hbtn"
            style={{ opacity: canRedo ? 1 : 0.3 }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 7l5 5-5 5M20 12H9a5 5 0 0 0 0 10h1"/></svg>
          </button>
        </div>

        {/* Centre volontairement vide : il ne sert qu'à pousser les actions à
            droite. La consigne « Sélectionnez un calque » qui s'y trouvait
            mangeait la largeur et finissait coupée. */}
        <div className="ed-topbar-center" style={{ flex: 1, minWidth: 0 }} />

        {/* Right: Type selector + Aperçu + Partager */}
        <div className="ed-topbar-right" style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {isTemplate ? (
            /* Format pills (template mode) */
            <div className="ed-type-pills" style={{ display: 'flex', alignItems: 'center', gap: 2, height: 32, padding: '0 3px', background: 'var(--btn-soft)', borderRadius: 'var(--r-s)', flexShrink: 0 }}>
              {FORMATS.map(f => (
                <button key={f.id} onClick={() => setFormatId(f.id)}
                  style={{ height: 26, padding: '0 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 700, fontFamily: 'var(--sans)', transition: 'all .12s',
                    background: formatId === f.id ? 'var(--btn-soft-2)' : 'transparent',
                    color: formatId === f.id ? 'var(--ink)' : 'var(--ink-3)',
                  }}>
                  {f.label}
                </button>
              ))}
            </div>
          ) : (
            <>
              {/* Post type pills */}
              <div className="ed-type-pills" style={{ display: 'flex', alignItems: 'center', gap: 2, height: 32, padding: '0 3px', background: 'var(--btn-soft)', borderRadius: 'var(--r-s)', flexShrink: 0 }}>
                {/* Plus de pastille « Carrousel » : plusieurs pages suffisent à en faire
                    un. Elle reste affichée pour un post créé avant cette fusion. */}
                {(['post', 'reel', 'story', 'carrousel'] as const).filter(t => t !== 'carrousel' || postType === 'carrousel').map(t => (
                  <button key={t} onClick={() => changePostType(t)}
                    style={{ height: 26, padding: '0 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 700, fontFamily: 'var(--sans)', transition: 'all .12s',
                      background: postType === t ? 'var(--btn-soft-2)' : 'transparent',
                      color: postType === t ? 'var(--ink)' : 'var(--ink-3)',
                    }}>
                    {t === 'post' ? 'Post' : t === 'reel' ? 'Reel' : t === 'story' ? 'Story' : 'Carrousel'}
                  </button>
                ))}
              </div>
              <button onClick={() => composeWithAI()} disabled={qaBusy} className="btn btn-sm ed-ai-btn" title={T('aiComposeTip')}
                style={{ height: 32, opacity: qaBusy ? 0.6 : 1, cursor: qaBusy ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 3l1.6 4.9L16 9.5l-4.9 1.6L9.5 16l-1.6-4.9L3 9.5l4.9-1.6z"/><path d="M18 14l.8 2.5L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.5z"/></svg>
                <span className="ed-hide-md">{aiVariants.length ? 'Recomposer' : 'Composer (IA)'}</span>
              </button>
              {aiVariants.length > 1 && (
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 3, height: 32, padding: '0 3px', background: 'var(--btn-soft)', borderRadius: 9, flexShrink: 0 }} title={T('aiPickVariant')}>
                  {/* Une phrase, une fois, au-dessus des pastilles : le seul moment
                      où la personne compare vraiment trois mises en page. Son choix
                      nourrit les compositions suivantes. */}
                  {variantAsked && (
                    <div style={{
                      position: 'absolute', top: 'calc(100% + 9px)', left: '50%', transform: 'translateX(-50%)',
                      zIndex: 40, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 8,
                      background: 'var(--white)', color: 'var(--ink-2)', fontSize: 12, fontWeight: 600,
                      padding: '8px 10px 8px 12px', borderRadius: 12,
                      boxShadow: '0 1px 3px rgba(16,19,11,.06), 0 14px 30px -16px rgba(16,19,11,.42)',
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--leaf)', flexShrink: 0 }} />
                      Laquelle préférez-vous&nbsp;? Votre choix guidera les prochaines.
                      <button onClick={() => setVariantAsked(false)} aria-label="Fermer"
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 15, lineHeight: 1, padding: 0 }}>×</button>
                    </div>
                  )}
                  {aiVariants.map((_, i) => (
                    <button key={i} onClick={() => selectVariant(i)} disabled={qaBusy}
                      style={{ width: 26, height: 26, borderRadius: 6, border: 'none', cursor: qaBusy ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 800, fontFamily: 'var(--sans)',
                        background: i === aiVariantIdx ? 'var(--btn-soft-2)' : 'transparent', color: i === aiVariantIdx ? 'var(--ink)' : 'var(--ink-3)' }}>
                      {i + 1}
                    </button>
                  ))}
                </div>
              )}
              <button onClick={runVisualQA} disabled={qaBusy} className="btn btn-sm ed-ai-btn" title={T('aiQaTip')}
                style={{ height: 32, opacity: qaBusy ? 0.6 : 1, cursor: qaBusy ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 5.8L20 10l-5.8 1.9L12 18l-1.9-5.8L4 10l5.8-1.2z"/></svg>
                <span className="ed-hide-md">{qaBusy ? 'Analyse…' : 'Vérifier'}</span>
              </button>
              <div style={{ position: 'relative' }}>
                <button onClick={() => generateAI()} disabled={aiTyping} className="btn btn-sm ed-ai-btn" title={T('aiCaptionTip')}
                  style={{ height: 32, opacity: aiTyping ? 0.6 : 1, cursor: aiTyping ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg>
                  <span className="ed-hide-md">{aiTyping ? 'Rédaction…' : 'Régénérer la légende'}</span>
                </button>
                {(aiTyping || aiCaption) && (
                  <div style={{ position: 'absolute', top: '110%', right: 0, zIndex: 20, width: 280, maxHeight: 220, overflowY: 'auto', padding: '12px 14px', borderRadius: 10, background: 'var(--canvas)', border: '1px solid var(--line)', boxShadow: '0 12px 30px rgba(13,15,10,.18)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--ink-3)', marginBottom: 6 }}>{T('generatedCaption')}</div>
                    <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--ink)', whiteSpace: 'pre-wrap', margin: 0 }}>{aiCaption || '…'}</p>
                  </div>
                )}
              </div>
            </>
          )}
          <button onClick={exportPNG} className="btn btn-sm ed-ai-btn" style={{ height: 32 }}>{T('preview')}</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-sm btn-primary"
            style={{ height: 32, opacity: saving ? 0.6 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Sauvegarde…' : isTemplate ? 'Enregistrer' : 'Publier'}
          </button>
        </div>
      </div>

      {/* ── Barre contextuelle MOBILE (au-dessus du rail) ── */}
      {selectedEl && (
        <div className="ed-mobile-ctx" data-stop-deselect>
          <EditorContextToolbar
            sel={toolbarSel ?? selectedEl}
            fontGroups={groupesDePolices}
                brandFamilies={brandFamilies}
            brandColors={[workspaceData?.primary_color, workspaceData?.secondary_color, workspaceData?.accent_color].filter(Boolean) as string[]}
            stageW={stageW}
            stageH={stageH}
            onUpdate={(patch) => updateTextAwareEl(selectedEl, patch)}
            onAlign={alignEl}
            onDuplicate={duplicateEl}
            onDelete={() => deleteEl(selectedId)}
            onCrop={selectedEl.type === 'image' ? () => setCropId(selectedEl.id) : undefined}
            onSetBg={selectedEl.type === 'image' ? () => setProxyUrl((selectedEl as ImageEl).src) : undefined}
            onMaskPhoto={selectedEl.type === 'vector' ? () => maskPhotoInputRef.current?.click() : undefined}
            onRemoveBg={selectedEl.type === 'image' ? () => removeBgFromImage(selectedEl as ImageEl) : undefined}
            bgRemoving={bgRemovingId === selectedEl.id}
            onLayerAction={layerAction}
            onOpenFx={openFxPanel}
            fxPanel={fxPanel}
          />
        </div>
      )}

      {/* ── BODY: rail + flyout + canvas workspace ── */}
      <div className={`ed-body${tool ? ' ed-open' : ''}`} style={{ flex: 1, display: 'flex', minHeight: 0 }}>

        {/* ── TOOL RAIL (68px) ── */}
        <div data-stop-deselect className="ed-rail" style={{ width: 88, background: 'var(--canvas)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 0', gap: 6, flexShrink: 0 }}>
          {([
            { id: 'design',   label: 'Modèles',  icon: <svg width="29" height="29" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2.5"/><line x1="9" y1="4" x2="9" y2="20"/></svg> },
            { id: 'elements', label: 'Éléments', icon: <svg width="29" height="29" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="7" cy="8" r="3.4"/><rect x="12.5" y="4.6" width="7" height="7" rx="1.7"/><path d="M8 14.2l4.2 6.2H3.8l4.2-6.2z"/></svg> },
            { id: 'text',     label: 'Texte',    icon: <svg width="29" height="29" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><polyline points="5 6.5 5 4 19 4 19 6.5"/><line x1="12" y1="4" x2="12" y2="20"/><line x1="9" y1="20" x2="15" y2="20"/></svg> },
            { id: 'photos',   label: 'Photos',   icon: <svg width="29" height="29" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2.5"/><circle cx="8.5" cy="8.5" r="1.6"/><path d="M21 15l-5-5L5 21"/></svg> },
            { id: 'brand',    label: 'Charte',   icon: <svg width="29" height="29" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a9 9 0 0 0 0 18 2.4 2.4 0 0 0 2-3.7 1.4 1.4 0 0 1 1.2-2.2H17a4 4 0 0 0 4-4c0-4.4-4-8.1-9-8.1z"/><circle cx="7.5" cy="11" r="1.1" fill="currentColor" stroke="none"/><circle cx="12" cy="7.8" r="1.1" fill="currentColor" stroke="none"/><circle cx="16.3" cy="11" r="1.1" fill="currentColor" stroke="none"/></svg> },
            { id: 'upload',   label: 'Importer', icon: <svg width="29" height="29" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V3"/><path d="M8 7l4-4 4 4"/><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/></svg> },
            { id: 'calques',  label: 'Calques',  icon: <svg width="29" height="29" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg> },
          ] as const).map(({ id, label, icon }) => (
            <button key={id} onClick={() => { setTool(tool === id ? null : id); setFxPanel(null); if (isPenMode) cancelPenMode(); }} title={label}
              style={{ width: 76, height: 74, borderRadius: 12, border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', transition: 'background .14s',
                background: 'transparent', color: tool === id ? 'var(--ink)' : 'var(--ink-2)' }}
              onMouseEnter={e => { if (tool !== id) e.currentTarget.style.background = 'rgba(13,15,10,.05)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
              {/* Outil actif : pastille pleine autour du picto (grammaire Canva),
                  au lieu d'un cadre teinté autour de tout le bouton. */}
              <span style={{ width: 42, height: 42, borderRadius: 13, display: 'grid', placeItems: 'center', transition: 'background .14s, color .14s',
                background: tool === id ? 'var(--leaf)' : 'transparent', color: tool === id ? 'var(--leaf-ink)' : 'inherit' }}>
                {icon}
              </span>
              <span style={{ fontFamily: 'var(--sans)', fontWeight: tool === id ? 800 : 600, fontSize: 11.5, letterSpacing: 0, lineHeight: 1 }}>{label}</span>
            </button>
          ))}
          <div style={{ width: 32, height: 1, background: 'var(--sunk)', margin: '4px 0' }} />
          <button onClick={() => { setIsPenMode(p => !p); setTool(null); }} title={T('penToolTip')}
            style={{ width: 76, height: 74, borderRadius: 12, border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: isPenMode ? 'crosshair' : 'pointer', transition: 'background .14s',
              background: 'transparent', color: isPenMode ? 'var(--ink)' : 'var(--ink-2)' }}
            onMouseEnter={e => { if (!isPenMode) e.currentTarget.style.background = 'rgba(13,15,10,.05)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
            <span style={{ width: 42, height: 42, borderRadius: 13, display: 'grid', placeItems: 'center', transition: 'background .14s, color .14s',
              background: isPenMode ? 'var(--leaf)' : 'transparent', color: isPenMode ? 'var(--leaf-ink)' : 'inherit' }}>
            <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>
            </span>
            <span style={{ fontFamily: 'var(--sans)', fontWeight: isPenMode ? 800 : 600, fontSize: 11, letterSpacing: 0, lineHeight: 1 }}>{T('penTool')}</span>
          </button>
        </div>

        {/* ── TOOL PANEL FLYOUT (312px, conditional) ── */}
        {tool && (
          <div data-stop-deselect className="ed-panel" style={{ width: 360, background: 'var(--white)', overflowY: 'auto', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>

            {/* DESIGN — Modèles */}
            {tool === 'design' && (
              <div style={{ padding: '22px' }}>
                <PanelHead title={T('templates')} sub={`Mises en page · ${workspaceName}`} onClose={() => setTool(null)} />
                <div style={{ position: 'relative', marginBottom: 16 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" style={{ position: 'absolute', left: 14, top: 15, color: 'var(--ink-3)', pointerEvents: 'none' }}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>
                  <input className="input" placeholder={T('searchTemplate')} style={{ paddingLeft: 40, height: 46, fontSize: 14, background: 'var(--sunk)', border: '1px solid transparent', borderRadius: 12 }} />
                </div>
                {/* ── MISES EN PAGE — compositions complètes, même principe que les
                       combinaisons de texte : version de base ou version à la charte ── */}
                {(() => {
                  const brandKit: BrandKit = { primary: workspaceData?.primary_color, secondary: workspaceData?.secondary_color, accent: workspaceData?.accent_color, font: workspaceData?.font_family };
                  const hasCharter = !!(brandKit.primary || brandKit.accent);
                  const useCharter = ltCharter && hasCharter;
                  const shown = (tpl: LayoutTemplate) => useCharter ? adaptLayoutToCharter(tpl, brandKit) : tpl;
                  const list = LAYOUT_TEMPLATES
                    .filter(t => ltStyle === 'Tous' || t.style === ltStyle)
                    .filter(t => ltCat === 'Tous' || t.cat === ltCat);
                  return (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, margin: '0 0 8px' }}>
                        <p className="label" style={{ margin: 0 }}>Mises en page <span style={{ fontFamily: 'var(--mono)', color: 'var(--ink-3)', fontWeight: 700 }}>({list.length})</span></p>
                        {hasCharter && (
                          <button onClick={() => setLtCharter(v => !v)} title="Adapter les mises en page à la charte du client"
                            style={{ fontSize: 10.5, fontWeight: 700, padding: '4px 9px', borderRadius: 'var(--r-btn)', cursor: 'pointer', border: '1px solid ' + (useCharter ? 'var(--leaf)' : 'var(--line)'), background: useCharter ? 'var(--leaf)' : 'transparent', color: useCharter ? '#06281C' : 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span style={{ width: 8, height: 8, borderRadius: 2, background: brandKit.accent || brandKit.primary || '#BDF2A0', display: 'inline-block' }} />
                            À ma charte
                          </button>
                        )}
                      </div>
                      {/* Deux axes de tri : le style (le look) et l'usage (le contenu).
                          Le style d'abord — c'est ce qui décide si un modèle « va » au client. */}
                      <div style={{ display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 7 }}>
                        {(['Tous', ...LAYOUT_STYLES] as string[]).map(s => (
                          <button key={s} onClick={() => setLtStyle(s)}
                            style={{ flexShrink: 0, fontSize: 12.5, fontWeight: 700, padding: '6px 13px', borderRadius: 'var(--r-btn)', cursor: 'pointer', border: 'none',
                              background: ltStyle === s ? 'var(--ink)' : 'var(--sunk)',
                              color: ltStyle === s ? 'var(--paper)' : 'var(--ink-2)' }}>
                            {s}
                          </button>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 8, marginBottom: 10 }}>
                        {(['Tous', ...LAYOUT_CATS] as string[]).map(c => (
                          <button key={c} onClick={() => setLtCat(c)}
                            style={{ flexShrink: 0, fontSize: 11.5, fontWeight: 700, padding: '5px 12px', borderRadius: 'var(--r-btn)', cursor: 'pointer', border: 'none',
                              background: ltCat === c ? 'var(--mint-soft)' : 'transparent',
                              color: ltCat === c ? 'var(--mint-2)' : 'var(--ink-3)' }}>
                            {c}
                          </button>
                        ))}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 18 }}>
                        {list.map(tpl => {
                          const t = shown(tpl);
                          return (
                            <button key={tpl.id} onClick={() => { void applyLayoutTemplate(t); }} title={`${tpl.name} · ${tpl.cat}`}
                              style={{ padding: 0, borderRadius: 12, border: 'none', cursor: 'pointer', overflow: 'hidden', background: 'transparent', transition: 'transform .14s', display: 'block' }}
                              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; }}
                              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}>
                              <LayoutThumb tpl={t} w={150} h={188} />
                              <div style={{ padding: '8px 2px 0', textAlign: 'left' }}>
                                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tpl.name}</div>
                                <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{tpl.style}{tpl.photos > 1 ? ` · ${tpl.photos} photos` : ''}</div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}

                <p className="label" style={{ marginBottom: 9 }}>{T('backgrounds')}</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 9 }}>
                  {([
                    { from: '#2b8d57', to: '#0c2a1d', angle: 150 },
                    { from: '#2FD79B', to: '#06281C', angle: 150 },
                    { from: '#F5F0E8', to: '#c9c4b2', angle: 150 },
                    { from: '#111111', to: '#333333', angle: 150 },
                    { from: '#0038FF', to: '#001a80', angle: 150 },
                    { from: '#FF6B6B', to: '#c0392b', angle: 150 },
                    { from: '#FFD700', to: '#b8860b', angle: 150 },
                    { from: '#a855f7', to: '#4c1d95', angle: 150 },
                    { from: '#f97316', to: '#7c2d12', angle: 150 },
                  ] as const).map(({ from, to, angle }, i) => (
                    <button key={i} onClick={() => setBgStyle({ type: 'gradient', colorFrom: from, colorTo: to, angle })}
                      style={{ aspectRatio: '4/5', borderRadius: 11, background: `linear-gradient(${angle}deg,${from},${to})`, border: 'none', cursor: 'pointer', transition: 'transform .12s',
                        boxShadow: 'inset 0 0 0 1px rgba(13,15,10,.10)' }}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.04)'; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }} />
                  ))}
                </div>
              </div>
            )}

            {/* ELEMENTS — Éléments */}
            {tool === 'elements' && (
              <div style={{ padding: '22px' }}>
                <PanelHead title={T('elements')} sub="Formes & blocs de couleur" onClose={() => setTool(null)} />
                <div style={{ position: 'relative', marginBottom: 16 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" style={{ position: 'absolute', left: 12, top: 12, color: 'var(--ink-3)', pointerEvents: 'none' }}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>
                  <input className="input" placeholder={T('searchElement')} value={iconQuery} onChange={e => setIconQuery(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); fetchIcons(iconQuery); } }}
                    style={{ paddingLeft: 36, height: 40, background: 'var(--sunk)', border: 'none' }} />
                </div>

                {/* ── Parcourir par catégorie (tuiles colorées façon Canva) ── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 18 }}>
                  {([
                    { label: 'Formes',   q: 'shape',        grad: 'linear-gradient(135deg, var(--mint), var(--mint-2))',      fg: '#06281C', glyph: <><rect x="4" y="4" width="7" height="7" rx="1.6"/><circle cx="17" cy="7.5" r="3.6"/><polygon points="8 22 3 15 13 15"/></> },
                    { label: 'Flèches',  q: 'arrow',        grad: 'linear-gradient(135deg, var(--acid), var(--mint))',        fg: '#06281C', glyph: <path d="M4 12h13M12 6l6 6-6 6"/> },
                    { label: 'Icônes',   q: 'star',         grad: 'linear-gradient(135deg, var(--mint-2), var(--forest-2))',  fg: '#FFFFFF', glyph: <polygon points="12 3 14.6 9 21 9.4 16 13.8 17.6 20 12 16.6 6.4 20 8 13.8 3 9.4 9.4 9"/> },
                    { label: 'Illustrations', q: 'illustration', grad: 'linear-gradient(135deg, var(--forest-3), var(--forest))', fg: '#FFFFFF', glyph: <><rect x="3" y="4" width="18" height="14" rx="2"/><circle cx="8" cy="9" r="1.6"/><path d="M3 16l5-4 4 3 3-2 6 5"/></> },
                    { label: 'Cadres',   q: 'frame',        grad: 'linear-gradient(135deg, var(--forest), var(--forest-3))',  fg: '#FFFFFF', glyph: <><rect x="3" y="3" width="18" height="18" rx="1.5"/><rect x="7" y="7" width="10" height="10" rx="1"/></> },
                    { label: 'Stickers', q: 'sticker',      grad: 'linear-gradient(135deg, var(--acid), var(--mint-2))',      fg: '#06281C', glyph: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8l6-6V5a2 2 0 0 0-2-2z"/><path d="M14 21v-4a2 2 0 0 1 2-2h4"/></> },
                  ]).map(({ label, q, grad, fg, glyph }) => (
                    <button key={label} onClick={() => { setIconQuery(q); fetchIcons(q); }} title={label}
                      style={{ position: 'relative', aspectRatio: '1', borderRadius: 14, border: 'none', cursor: 'pointer', background: grad, color: fg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, overflow: 'hidden', boxShadow: '0 2px 8px color-mix(in srgb, var(--forest) 14%, transparent)', transition: 'transform .12s' }}
                      onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
                      onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{glyph}</svg>
                      <span style={{ fontSize: 10.5, fontFamily: 'var(--sans)', fontWeight: 700, letterSpacing: 0 }}>{label}</span>
                    </button>
                  ))}
                </div>

                <p style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: 'var(--mono)', fontWeight: 800, margin: '0 0 8px' }}>{T('shapes')}</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 18 }}>
                  {([
                    { shape: 'rectangle' as const, label: 'Carré',    icon: <rect x="5" y="5" width="14" height="14" rx="2.5" fill="currentColor"/> },
                    { shape: 'circle' as const,    label: 'Cercle',   icon: <circle cx="12" cy="12" r="7.5" fill="currentColor"/> },
                    { shape: 'pill' as const,      label: 'Pilule',   icon: <rect x="3" y="8" width="18" height="8" rx="4" fill="currentColor"/> },
                    { shape: 'triangle' as const,  label: 'Triangle', icon: <polygon points="12,4 21,20 3,20" fill="currentColor"/> },
                    { shape: 'star' as const,      label: 'Étoile',   icon: <polygon points="12,3 14.5,9 21,9.5 16,14 17.5,21 12,17.5 6.5,21 8,14 3,9.5 9.5,9" fill="currentColor"/> },
                    { shape: 'diamond' as const,   label: 'Losange',  icon: <polygon points="12,3 21,12 12,21 3,12" fill="currentColor"/> },
                    { shape: 'hexagon' as const,   label: 'Hexagone', icon: <polygon points="12,3 20,7.5 20,16.5 12,21 4,16.5 4,7.5" fill="currentColor"/> },
                    { shape: 'arrow' as const,     label: 'Flèche',   icon: <path fill="currentColor" strokeLinejoin="round" d="M3 10h11V6l7 6-7 6v-4H3z"/> },
                  ]).map(({ shape, label, icon }) => (
                    <button key={shape} onClick={() => addVector(shape)}
                      style={{ aspectRatio: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, cursor: 'pointer', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--white)', transition: 'all .15s' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--leaf)'; e.currentTarget.style.background = 'var(--sunk)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.background = 'var(--white)'; }}>
                      <svg width="26" height="26" viewBox="0 0 24 24" style={{ color: 'var(--ink)' }}>{icon}</svg>
                      <span style={{ fontSize: 8.5, fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</span>
                    </button>
                  ))}
                </div>
                {/* ── Cadres photo (patterns) : forme vide → on clippe une image dedans ── */}
                <p style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: 'var(--mono)', fontWeight: 800, margin: '0 0 3px' }}>Cadres photo</p>
                <p style={{ fontSize: 10.5, color: 'var(--ink-3)', margin: '0 0 8px', lineHeight: 1.35 }}>Pose une forme, choisis ta photo : elle se clippe dedans. Double-clic pour recadrer.</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 18 }}>
                  {([
                    { shape: 'rectangle' as const, label: 'Carré',    icon: <rect x="4" y="4" width="16" height="16" rx="2.5" /> },
                    { shape: 'circle' as const,    label: 'Rond',     icon: <circle cx="12" cy="12" r="8" /> },
                    { shape: 'pill' as const,      label: 'Pilule',   icon: <rect x="3" y="7" width="18" height="10" rx="5" /> },
                    { shape: 'triangle' as const,  label: 'Triangle', icon: <polygon points="12,4 21,20 3,20" /> },
                    { shape: 'star' as const,      label: 'Étoile',   icon: <polygon points="12,3 14.5,9 21,9.5 16,14 17.5,21 12,17.5 6.5,21 8,14 3,9.5 9.5,9" /> },
                    { shape: 'diamond' as const,   label: 'Losange',  icon: <polygon points="12,3 21,12 12,21 3,12" /> },
                    { shape: 'hexagon' as const,   label: 'Hexagone', icon: <polygon points="12,3 20,7.5 20,16.5 12,21 4,16.5 4,7.5" /> },
                    { shape: 'arrow' as const,     label: 'Flèche',   icon: <path strokeLinejoin="round" d="M3 10h11V6l7 6-7 6v-4H3z" /> },
                  ]).map(({ shape, label, icon }) => (
                    <button key={shape} onClick={() => addFrame(shape)} title={`Cadre ${label}`}
                      style={{ aspectRatio: '1', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, cursor: 'pointer', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--white)', transition: 'all .15s' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--leaf)'; e.currentTarget.style.background = 'var(--sunk)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.background = 'var(--white)'; }}>
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--ink-2)" strokeWidth="1.8">{icon}</svg>
                      <span style={{ fontSize: 8.5, fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</span>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--mint-2)" strokeWidth="3" strokeLinecap="round" style={{ position: 'absolute', top: 6, right: 6 }}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    </button>
                  ))}
                </div>
                {/* ── Stickers / illustrations maison ── */}
                <p style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: 'var(--mono)', fontWeight: 800, margin: '0 0 8px' }}>Stickers</p>
                {/* palette recolorable (agit sur les stickers recolorables) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 9 }}>
                  {[workspaceData?.primary_color || '#2FD79B', '#0C2A1D', '#BDF2A0', '#FF5A3C', '#FFD400', '#0038FF', '#9B5DE5', '#F15BB5', '#14160F', '#FFFFFF'].map(c => (
                    <button key={c} onClick={() => setStickerColor(c)} title={c}
                      style={{ width: 22, height: 22, borderRadius: '50%', background: c, cursor: 'pointer', border: stickerColor === c ? '2px solid var(--leaf)' : '1.5px solid var(--line)', padding: 0, boxShadow: c === '#FFFFFF' ? 'inset 0 0 0 1px var(--line)' : 'none' }} />
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 10 }}>
                  {STICKERS.slice(0, 12).map(s => (
                    <button key={s.id} onClick={() => addSticker(s)} title={s.name}
                      style={{ aspectRatio: '1', borderRadius: 10, border: '1px solid var(--line)', background: s.recolor && stickerColor === '#FFFFFF' ? '#3a3f36' : 'var(--sunk)', cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 7, transition: 'all .14s' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--leaf)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.transform = 'none'; }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={stickerDataUri(s, stickerColor)} alt={s.name} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                    </button>
                  ))}
                </div>
                <button onClick={() => { setStickerCat('Tous'); setStickerLibQuery(''); setStickerLibOpen(true); }} className="btn btn-ghost btn-sm"
                  style={{ width: '100%', justifyContent: 'center', marginBottom: 18, height: 40, gap: 6 }}>
                  Voir toute la bibliothèque
                  <span style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--mono)', fontWeight: 700 }}>({STICKERS.length})</span>
                </button>

                <p style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: 'var(--mono)', fontWeight: 800, margin: '0 0 8px' }}>{T('badges')}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {['NOUVEAU', '-20%', 'RÉSA EN BIO'].map(badge => (
                    <button key={badge} onClick={() => { const el: TextEl = { id: newId(), type: 'text', x: 60, y: 60, rotation: 0, opacity: 100, text: badge, fontSize: 32, fontFamily: 'Archivo', fontStyle: 'bold', textDecoration: '', fill: '#fff', align: 'center', width: 220, hasBg: true, bgColor: workspaceData?.primary_color || '#0038FF', bgOpacity: 100, cornerRadius: 8, padding: 16, paddingH: 20, paddingV: 12 }; applyElements([...elements, el]); setSelectedId(el.id); }}
                      style={{ padding: '9px 14px', borderRadius: 8, border: '1.5px solid var(--line)', cursor: 'pointer', fontSize: 13, fontFamily: 'Archivo', fontWeight: 800, letterSpacing: '.05em', color: 'var(--ink-2)', background: 'var(--sunk)', textAlign: 'left' }}>
                      {badge}
                    </button>
                  ))}
                </div>

                {/* ── Icônes SVG (Iconify) ── */}
                <p style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: 'var(--mono)', fontWeight: 800, margin: '20px 0 8px' }}>{T('iconsStickers')}</p>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)', pointerEvents: 'none' }}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>
                    <input value={iconQuery} onChange={e => setIconQuery(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); fetchIcons(iconQuery); } }}
                      enterKeyHint="search" inputMode="search" autoCapitalize="none" autoCorrect="off"
                      placeholder={T('searchIcon')}
                      style={{ width: '100%', padding: '8px 10px 8px 32px', border: '1.5px solid var(--line)', borderRadius: 8, fontSize: 12.5, outline: 'none', fontFamily: 'var(--sans)', background: 'var(--white)', color: 'var(--ink)', boxSizing: 'border-box' }} />
                  </div>
                  <button type="button" onClick={() => fetchIcons(iconQuery)} aria-label={T('search')}
                    style={{ flexShrink: 0, width: 40, borderRadius: 8, border: 'none', background: 'var(--mint, #2FD79B)', color: '#06281C', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>
                  </button>
                </div>
                {/* couleur d'icône */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
                  <span style={{ fontSize: 10, color: 'var(--ink-3)', fontFamily: 'var(--mono)', fontWeight: 700 }}>{T('colorLabel')}</span>
                  {[['#14160F', 'Noir'], ['#FFFFFF', 'Blanc'], [workspaceData?.primary_color || '#2FD79B', 'Marque']].map(([c]) => (
                    <button key={c} onClick={() => setIconColor(c)} title={c}
                      style={{ width: 22, height: 22, borderRadius: 6, background: c, cursor: 'pointer', border: iconColor === c ? '2px solid var(--mint, #2FD79B)' : '1.5px solid var(--line)', padding: 0 }} />
                  ))}
                </div>
                {iconLoading ? (
                  <p style={{ fontSize: 12, color: 'var(--ink-3)', textAlign: 'center', padding: '12px 0' }}>{T('loading')}</p>
                ) : iconResults.length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--ink-3)', textAlign: 'center', padding: '12px 0' }}>{T('noIcon')}</p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 6, marginBottom: 8 }}>
                    {iconResults.map(name => (
                      <button key={name} onClick={() => addIcon(name)} title={name}
                        style={{ aspectRatio: '1', borderRadius: 8, border: '1px solid var(--line)', background: iconColor === '#FFFFFF' ? '#3a3f36' : 'var(--sunk)', cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 6 }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={iconSvgUrl(name, iconColor, 48)} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                      </button>
                    ))}
                  </div>
                )}

                {/* ── Motifs ── */}
                <p style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: 'var(--mono)', fontWeight: 800, margin: '16px 0 8px' }}>{T('patterns')}</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 7 }}>
                  {([
                    { label: 'Pois', inner: (c: string) => `<pattern id='a' width='44' height='44' patternUnits='userSpaceOnUse'><circle cx='12' cy='12' r='6' fill='${c}'/></pattern>`, id: 'a' },
                    { label: 'Rayures', inner: (c: string) => `<pattern id='b' width='28' height='28' patternUnits='userSpaceOnUse' patternTransform='rotate(45)'><rect width='10' height='28' fill='${c}'/></pattern>`, id: 'b' },
                    { label: 'Grille', inner: (c: string) => `<pattern id='c' width='40' height='40' patternUnits='userSpaceOnUse'><path d='M40 0H0V40' fill='none' stroke='${c}' stroke-width='3'/></pattern>`, id: 'c' },
                    { label: 'Vagues', inner: (c: string) => `<pattern id='d' width='60' height='30' patternUnits='userSpaceOnUse'><path d='M0 15 Q15 0 30 15 T60 15' fill='none' stroke='${c}' stroke-width='4'/></pattern>`, id: 'd' },
                    { label: 'Chevrons', inner: (c: string) => `<pattern id='e' width='40' height='24' patternUnits='userSpaceOnUse'><path d='M0 22 L20 4 L40 22' fill='none' stroke='${c}' stroke-width='4'/></pattern>`, id: 'e' },
                    { label: 'Confettis', inner: (c: string) => `<pattern id='f' width='60' height='60' patternUnits='userSpaceOnUse'><rect x='8' y='10' width='10' height='10' rx='2' fill='${c}' transform='rotate(20 13 15)'/><circle cx='44' cy='20' r='5' fill='${c}'/><rect x='30' y='42' width='9' height='9' rx='2' fill='${c}' transform='rotate(-15 34 46)'/></pattern>`, id: 'f' },
                  ]).map(({ label, inner, id }) => {
                    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='600'><defs>${inner(iconColor)}</defs><rect width='600' height='600' fill='url(#${id})'/></svg>`;
                    const uri = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
                    return (
                      <button key={label} onClick={() => addPattern(svg)} title={label} className="well"
                        style={{ aspectRatio: '1', borderRadius: 10, cursor: 'pointer', overflow: 'hidden', padding: 0, background: iconColor === '#FFFFFF' ? '#3a3f36' : 'var(--sunk)' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={uri} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TEXT */}
            {tool === 'text' && (
              <div style={{ padding: '22px' }}>
                <PanelHead title={T('text')} onClose={() => setTool(null)} />

                {/* ── ZONES PAR RÔLE IA — EN TÊTE DU PANNEAU ──────────────────
                    C'est la raison d'être d'un template : sans zones portant un
                    rôle, l'IA n'a aucun emplacement à remplir et le modèle n'est
                    qu'un dessin figé. C'était pourtant enterré sous la
                    bibliothèque de textes, en gris discret (retour de Martin :
                    « sans ça cet outil ne sert à rien »). */}
                {isTemplate && (
                  <div data-tour="template-ai-zones" style={{
                    borderRadius: 16, marginBottom: 18, overflow: 'hidden',
                    background: 'var(--forest, #0C2A1D)',
                  }}>
                    <div style={{ padding: '15px 16px 13px' }}>
                      <span style={{
                        display: 'inline-block', fontSize: 9.5, fontFamily: 'var(--mono)', fontWeight: 800,
                        letterSpacing: '0.14em', textTransform: 'uppercase',
                        color: 'var(--forest, #0C2A1D)', background: 'var(--mint-2, #BDF2A0)',
                        padding: '3px 8px', borderRadius: 99, marginBottom: 9,
                      }}>{T('aiRoleBadge')}</span>
                      <p style={{ fontSize: 15, fontWeight: 800, color: '#FFFFFF', margin: '0 0 5px', lineHeight: 1.2 }}>
                        {T('aiRoleZones')}
                      </p>
                      <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,.72)', margin: 0, lineHeight: 1.45 }}>
                        {T('aiRoleZonesHint')}
                      </p>
                    </div>
                    <div style={{ padding: '0 16px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      {([['accroche', 'Accroche'], ['titre', 'Titre'], ['sous-titre', 'Sous-titre'], ['corps', 'Corps'], ['cta', 'CTA'], ['prix', 'Prix']] as const).map(([role, label]) => (
                        <button key={role} onClick={() => addTextRole(role)}
                          style={{
                            padding: '10px 8px', cursor: 'pointer', fontSize: 12.5, fontWeight: 700,
                            borderRadius: 9, border: '1px solid rgba(255,255,255,.16)',
                            background: 'rgba(255,255,255,.07)', color: '#FFFFFF',
                            fontFamily: 'var(--sans)',
                          }}
                        >{label}</button>
                      ))}
                      {/* La photo est une zone comme les autres : c'est elle que
                          le générateur remplace par l'image du post. Elle
                          manquait, donc un template ne pouvait porter que du
                          texte (retour de Martin). */}
                      <button data-tour="template-photo-zone" onClick={addPhotoZone}
                        style={{
                          gridColumn: '1 / -1', padding: '11px 8px', cursor: 'pointer',
                          fontSize: 12.5, fontWeight: 800, borderRadius: 9, border: 'none',
                          background: 'var(--mint-2, #BDF2A0)', color: 'var(--forest, #0C2A1D)',
                          fontFamily: 'var(--sans)', display: 'flex', alignItems: 'center',
                          justifyContent: 'center', gap: 7,
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" />
                        </svg>
                        {T('aiRolePhoto')}
                      </button>
                    </div>
                  </div>
                )}

                <button onClick={addText} className="btn btn-dark" style={{ width: '100%', justifyContent: 'center', marginBottom: 16, gap: 8, height: 44 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Ajouter une zone de texte
                </button>

                {/* ── COMBINAISONS DE TEXTE — jeux de typo façon Canva, cliquez pour ajouter ── */}
                {(() => {
                  const brandKit: BrandKit = { primary: workspaceData?.primary_color, secondary: workspaceData?.secondary_color, accent: workspaceData?.accent_color, font: workspaceData?.font_family };
                  const hasCharter = !!(brandKit.primary || brandKit.accent);
                  const useCharter = ttCharter && hasCharter;
                  const show = (tpl: TextTemplate) => useCharter ? adaptTemplateToCharter(tpl, brandKit) : tpl;
                  return (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, margin: '0 0 8px' }}>
                        <p style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: 'var(--mono)', fontWeight: 800, margin: 0 }}>Combinaisons de texte</p>
                        {hasCharter && (
                          <button onClick={() => setTtCharter(v => !v)} title="Adapter les templates à la charte du client"
                            style={{ fontSize: 10.5, fontWeight: 700, padding: '4px 9px', borderRadius: 'var(--r-btn)', cursor: 'pointer', border: '1px solid ' + (useCharter ? 'var(--leaf)' : 'var(--line)'), background: useCharter ? 'var(--leaf)' : 'transparent', color: useCharter ? '#06281C' : 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span style={{ width: 8, height: 8, borderRadius: 2, background: brandKit.accent || brandKit.primary || '#BDF2A0', display: 'inline-block' }} />
                            À ma charte
                          </button>
                        )}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                        {TEXT_TEMPLATES.slice(0, 8).map(tpl => {
                          const shown = show(tpl);
                          return (
                            <button key={tpl.id} onClick={() => applyTextTemplate(shown)} title={tpl.cat}
                              style={{ height: 90, padding: '10px 8px', borderRadius: 12, border: '1px solid var(--line)', cursor: 'pointer', background: tpl.dark ? '#1B1D18' : 'var(--white)', display: 'grid', placeItems: 'center', transition: 'all .14s', overflow: 'hidden' }}
                              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--leaf)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.transform = 'none'; }}>
                              <TextTemplateThumb tpl={shown} w={150} />
                            </button>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}
                <button onClick={() => { setTextLibCat('Tous'); setTextLibQuery(''); setTextLibOpen(true); }} className="btn btn-ghost btn-sm"
                  style={{ width: '100%', justifyContent: 'center', marginBottom: 18, height: 40, gap: 6 }}>
                  Voir toute la bibliothèque
                  <span style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--mono)', fontWeight: 700 }}>({TEXT_TEMPLATES.length})</span>
                </button>

                <p style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: 'var(--mono)', fontWeight: 800, margin: '0 0 8px' }}>{T('styles')}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <button onClick={() => applyTemplate({ fontSize: 96, fontFamily: 'Archivo Black', fontStyle: 'normal', uppercase: true, letterSpacing: -2, lineHeight: 0.92, fill: workspaceData?.primary_color || '#14160F' } as Partial<TextEl>)}
                    style={{ padding: '14px', borderRadius: 10, border: '1px solid var(--line)', cursor: 'pointer', background: 'var(--white)', textAlign: 'left' }}>
                    <span style={{ fontFamily: 'Archivo Black', fontSize: 26, color: 'var(--ink)', display: 'block', lineHeight: 0.92, textTransform: 'uppercase', letterSpacing: -1 }}>{T('styleTitle')}</span>
                    <span style={{ fontSize: 10, color: 'var(--ink-3)', fontFamily: 'var(--mono)', fontWeight: 700 }}>Archivo Black · 96px</span>
                  </button>
                  <button onClick={() => applyTemplate({ fontSize: 44, fontFamily: 'Space Grotesk', fontStyle: 'bold', letterSpacing: -0.5, fill: workspaceData?.primary_color || '#14160F' } as Partial<TextEl>)}
                    style={{ padding: '14px', borderRadius: 10, border: '1px solid var(--line)', cursor: 'pointer', background: 'var(--white)', textAlign: 'left' }}>
                    <span style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 21, color: 'var(--ink)', display: 'block', lineHeight: 1, letterSpacing: -0.4 }}>{T('styleSubtitle')}</span>
                    <span style={{ fontSize: 10, color: 'var(--ink-3)', fontFamily: 'var(--mono)', fontWeight: 700 }}>Space Grotesk · 44px</span>
                  </button>
                  <button onClick={() => applyTemplate({ fontSize: 26, fontFamily: 'Satoshi', fontStyle: 'normal', lineHeight: 1.5, fill: '#14160F' } as Partial<TextEl>)}
                    style={{ padding: '14px', borderRadius: 10, border: '1px solid var(--line)', cursor: 'pointer', background: 'var(--white)', textAlign: 'left' }}>
                    <span style={{ fontFamily: 'Satoshi', fontWeight: 400, fontSize: 15, color: 'var(--ink-2)', display: 'block', lineHeight: 1.5 }}>{T('styleBody')}</span>
                    <span style={{ fontSize: 10, color: 'var(--ink-3)', fontFamily: 'var(--mono)', fontWeight: 700 }}>Satoshi · 26px</span>
                  </button>
                </div>
              </div>
            )}

            {/* PHOTOS */}
            {tool === 'photos' && (
              <div style={{ padding: '22px' }}>
                <PanelHead title={T('photos')} sub="Pexels · 3M+ photos" onClose={() => setTool(null)} />
                {isTemplate && (
                  <>
                    <button onClick={addPhotoPlaceholder} className="btn btn-dark" style={{ width: '100%', justifyContent: 'center', height: 44, marginBottom: 8, gap: 8, cursor: 'pointer' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                      Zone photo remplaçable
                    </button>
                    <p style={{ fontSize: 11, color: 'var(--ink-3)', margin: '0 0 14px', lineHeight: 1.4 }}>{T('photoZoneHint')}</p>
                  </>
                )}
                {/* Import local */}
                <label className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', height: 44, marginBottom: 14, cursor: 'pointer' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  Importer une photo
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileUpload} />
                </label>

                {/* Pexels search */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)', pointerEvents: 'none' }}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>
                    <input value={pexelsQuery} onChange={e => setPexelsQuery(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); fetchPexels(pexelsQuery, 1); } }}
                      enterKeyHint="search" inputMode="search" autoCapitalize="none" autoCorrect="off"
                      placeholder={T('searchPhotos')}
                      style={{ width: '100%', padding: '8px 10px 8px 32px', border: '1.5px solid var(--line)', borderRadius: 8, fontSize: 12.5, outline: 'none', fontFamily: 'var(--sans)', background: 'var(--white)', color: 'var(--ink)', boxSizing: 'border-box' }} />
                  </div>
                  <button type="button" onClick={() => fetchPexels(pexelsQuery || 'nature', 1)} aria-label={T('search')}
                    style={{ flexShrink: 0, width: 40, borderRadius: 8, border: 'none', background: 'var(--mint, #2FD79B)', color: '#06281C', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>
                  </button>
                </div>

                {/* Quick searches */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
                  {['Nature', 'Ville', 'Nourriture', 'Mode', 'Architecture'].map(q => (
                    <button key={q} onClick={() => { setPexelsQuery(q); fetchPexels(q, 1); }}
                      style={{ padding: '4px 10px', borderRadius: 20, border: '1px solid var(--line)', background: pexelsQuery === q ? 'var(--ink)' : 'var(--white)', color: pexelsQuery === q ? '#fff' : 'var(--ink-2)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}>
                      {q}
                    </button>
                  ))}
                </div>

                {/* Results grid */}
                {pexelsLoading && pexelsPhotos.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--ink-3)', fontSize: 13 }}>{T('loading')}</div>
                ) : pexelsPhotos.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--ink-3)', fontSize: 13 }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" style={{ marginBottom: 8, display: 'block', margin: '0 auto 8px' }}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                    Aucune photo — essayez un autre mot-clé.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    {pexelsPhotos.map(photo => (
                      <UnsplashThumb key={photo.id}
                        src={photo.src.medium}
                        dragSrc={`/api/proxy-image?url=${encodeURIComponent(photo.src.large)}`}
                        onAdd={() => addImageEl(`/api/proxy-image?url=${encodeURIComponent(photo.src.large)}`)}
                        onBg={() => { setProxyUrl(`/api/proxy-image?url=${encodeURIComponent(photo.src.large)}`); setBgOffsetX(0); setBgOffsetY(0); setBgCropMode(false); }} />
                    ))}
                  </div>
                )}

                {/* Voir plus */}
                {pexelsPhotos.length > 0 && pexelsPage < pexelsTotalPages && (
                  <button onClick={() => fetchPexels(pexelsQuery || 'nature', pexelsPage + 1)}
                    disabled={pexelsLoading}
                    style={{ width: '100%', marginTop: 10, padding: '9px 0', borderRadius: 8, border: '1.5px solid var(--line)', background: 'var(--sunk)', color: 'var(--ink-2)', fontSize: 13, fontWeight: 700, cursor: pexelsLoading ? 'wait' : 'pointer' }}>
                    {pexelsLoading ? 'Chargement…' : 'Voir plus'}
                  </button>
                )}

                {proxyUrl && (
                  <button onClick={() => setBgCropMode(v => !v)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, width: '100%', marginTop: 12,
                      background: bgCropMode ? 'var(--leaf)' : 'var(--sunk)', color: bgCropMode ? 'var(--mint-ink)' : 'var(--ink-2)' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
                    {bgCropMode ? 'Glissez le fond pour recadrer' : 'Recadrer le fond'}
                  </button>
                )}
              </div>
            )}

            {/* BRAND — Charte */}
            {tool === 'brand' && (
              <div style={{ padding: '22px' }}>
                <PanelHead title={T('brandKit')} sub={workspaceName} onClose={() => setTool(null)} />
                <SectionLabel>{T('colors')}</SectionLabel>
                <div style={{ display: 'flex', gap: 5, marginBottom: 16 }}>
                  {[workspaceData?.primary_color || '#0038FF', workspaceData?.secondary_color || '#FFFFFF', workspaceData?.accent_color].filter(Boolean).map((col, i) => (
                    <div key={i} style={{ flex: 1, cursor: 'pointer' }} title={`Copier ${col}`} onClick={() => { try { navigator.clipboard.writeText(col!); } catch {} }}>
                      <div style={{ height: 36, borderRadius: 6, background: col!, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.12)' }} />
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--ink-3)', marginTop: 3, textAlign: 'center', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{col}</div>
                    </div>
                  ))}
                </div>
                {brandFontNames.length > 0 && <>
                  <SectionLabel>{T('typography')}</SectionLabel>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                    {brandFontNames.map((font, i) => (
                      <div key={font} title={T('addTextWithFont')}
                        onClick={() => { const el: TextEl = { id: newId(), type: 'text', x: 30, y: 60 + i * 60, rotation: 0, opacity: 100, text: font, fontSize: 26, fontFamily: font, fontStyle: 'bold', textDecoration: '', fill: workspaceData?.primary_color || '#000', align: 'center', width: 260, hasBg: false, bgColor: '#000', bgOpacity: 80, cornerRadius: 4, padding: 12, paddingH: 12, paddingV: 8 }; applyElements([...elements, el]); setSelectedId(el.id); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 6, background: 'var(--white)', cursor: 'pointer', border: '1px solid var(--line)' }}>
                        <span style={{ fontFamily: `"${font}", sans-serif`, fontSize: 22, color: 'var(--ink)', lineHeight: 1 }}>Aa</span>
                        <span style={{ fontSize: 11, color: 'var(--ink-2)', fontWeight: 600 }}>{font}</span>
                      </div>
                    ))}
                  </div>
                </>}
                {(workspaceData?.logo_url || workspaceData?.logo_dark_url) && <>
                  <SectionLabel>{T('logo')}</SectionLabel>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                    {workspaceData?.logo_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={workspaceData.logo_url} alt="Logo" title={T('addToCanvas')} style={{ height: 38, maxWidth: 90, objectFit: 'contain', cursor: 'pointer', borderRadius: 5, background: 'var(--white)', padding: 4, border: '1px solid var(--line)' }} onClick={() => addLogoEl(workspaceData.logo_url!)} />
                    )}
                    {workspaceData?.logo_dark_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={workspaceData.logo_dark_url} alt="Logo variante" title={T('addToCanvasDark')} style={{ height: 38, maxWidth: 90, objectFit: 'contain', cursor: 'pointer', borderRadius: 5, background: '#1A1A1A', padding: 4, border: '1px solid var(--line)' }} onClick={() => addLogoEl(workspaceData.logo_dark_url!)} />
                    )}
                  </div>
                </>}
                {workspaceData?.brand_assets && workspaceData.brand_assets.length > 0 && <>
                  <SectionLabel>{T('brandAssets')}</SectionLabel>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
                    {workspaceData.brand_assets.map((url, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={url} alt="" title={T('addToCanvas')} draggable
                        onDragStart={e => e.dataTransfer.setData('application/x-klip-image', url)}
                        style={{ aspectRatio: '1', objectFit: 'contain', borderRadius: 6, background: 'var(--sunk)', padding: 4, border: '1px solid var(--line)', cursor: 'pointer', width: '100%', display: 'block' }}
                        onClick={() => addLogoEl(url)} />
                    ))}
                  </div>
                </>}
              </div>
            )}

            {/* UPLOAD — Importer */}
            {tool === 'upload' && (
              <div style={{ padding: '22px' }}>
                <PanelHead title={T('import')} onClose={() => setTool(null)} />
                <label className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', height: 44, marginBottom: 14, cursor: 'pointer' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  Choisir un fichier
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileUpload} />
                </label>
                <div
                  onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={e => { e.preventDefault(); e.stopPropagation(); const file = e.dataTransfer.files?.[0]; if (file) handleFileDrop(file); }}
                  style={{ border: '1.5px solid var(--line)', borderRadius: 10, padding: '32px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: 'var(--ink-3)' }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' }}>{T('dropFilesHere')}</span>
                  <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{T('fileFormats')}</span>
                </div>
              </div>
            )}

            {/* CALQUES — Layers panel */}
            {tool === 'calques' && (
              <div style={{ padding: '22px' }}>
                <PanelHead title={T('layers')} sub="Ordre et verrouillage" onClose={() => setTool(null)} />
                <RailLayerList
                  elements={elements}
                  selectedId={selectedId}
                  hiddenIds={hiddenIds}
                  lockedIds={lockedIds}
                  onSelect={id => setSelectedId(id)}
                  onReorder={reorderLayers}
                  onToggleHidden={toggleHidden}
                  onToggleLocked={toggleLocked}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 6 }}>
                  {/* Fond (background) layer — always last */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, borderTop: elements.length > 0 ? '1px solid var(--line)' : 'none', marginTop: elements.length > 0 ? 6 : 0 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
                    <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: proxyUrl ? 'var(--ink)' : 'var(--ink-3)' }}>Fond{!proxyUrl && ' (aucun)'}</span>
                    <button title={bgLocked ? 'Déverrouiller le fond' : 'Verrouiller le fond'}
                      onClick={() => { const next = !bgLocked; setBgLocked(next); if (next) setBgCropMode(false); else if (proxyUrl) setBgCropMode(true); }}
                      style={{ width: 28, height: 28, borderRadius: 7, display: 'grid', placeItems: 'center', border: 'none', cursor: 'pointer', background: 'transparent', color: bgLocked ? 'var(--ink-3)' : 'var(--mint-2)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--sunk)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      {bgLocked
                        ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                        : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>}
                    </button>
                  </div>
                </div>
                {!bgLocked && proxyUrl && (
                  <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 9, background: 'color-mix(in srgb, var(--mint) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--mint) 30%, transparent)', fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.4 }}>
                    Fond déverrouillé — glissez-le sur le canvas pour le repositionner.
                  </div>
                )}
                {canBeCarousel && (
                  <div style={{ marginTop: 12, padding: '12px', borderRadius: 9, background: 'var(--sunk)', border: '1px solid var(--line)' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>{T('linkedCarousel')}</div>
                    {/* Bascule Séparé / Continu */}
                    <div style={{ display: 'flex', gap: 4, background: 'var(--white)', border: '1px solid var(--line)', borderRadius: 8, padding: 3, marginBottom: 10 }}>
                      {([['separate', 'Séparé'], ['continuous', 'Continu']] as const).map(([mode, label]) => {
                        const active = (mode === 'continuous') === carouselContinuous;
                        return (
                          <button key={mode} onClick={() => toggleCarouselMode(mode === 'continuous')}
                            style={{ flex: 1, padding: '6px 4px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'var(--sans)', transition: 'all .15s', background: active ? 'var(--leaf)' : 'transparent', color: active ? '#06281C' : 'var(--ink-3)' }}>
                            {label}
                          </button>
                        );
                      })}
                    </div>
                    {carouselContinuous ? (
                      <>
                        <div style={{ fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.4, marginBottom: 10 }}>
                          Une seule grande toile : placez librement textes et éléments, ils peuvent chevaucher les volets. Découpée en {contPanels} slides à la publication.
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>Volets</span>
                          <input type="number" min={2} max={6} value={contPanels} onChange={e => setContPanels(Math.min(6, Math.max(2, parseInt(e.target.value) || 2)))}
                            style={{ width: 44, textAlign: 'center', borderRadius: 6, border: '1px solid var(--line)', padding: '4px 2px', fontSize: 12.5, fontWeight: 700 }} />
                        </div>
                      </>
                    ) : proxyUrl ? (
                      <>
                        <div style={{ fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.4, marginBottom: 10 }}>
                          Étend ce fond sur les slides suivantes pour un visuel continu (panorama) qui se découpe au balayage. Utilisez une photo large pour un meilleur résultat.
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>{T('on')}</span>
                          <input type="number" min={1} max={6} value={extendCount} onChange={e => setExtendCount(Math.min(6, Math.max(1, parseInt(e.target.value) || 1)))}
                            style={{ width: 44, textAlign: 'center', borderRadius: 6, border: '1px solid var(--line)', padding: '4px 2px', fontSize: 12.5, fontWeight: 700 }} />
                          <span style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>{T('nextSlides')}</span>
                        </div>
                        <button onClick={() => extendBgAcrossSlides(extendCount)} className="btn btn-sm btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}>
                          Étendre l&apos;image
                        </button>
                      </>
                    ) : (
                      <div style={{ fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.4 }}>
                        Ajoutez un fond pour étendre un panorama, ou passez en mode <b>Continu</b> pour une seule toile large.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

          </div>
        )}

        {/* ── PANNEAU GAUCHE CONTEXTUEL (Effet / Position) ── */}
        {selectedEl && (fxPanel === 'position' || (fxPanel === 'effects' && selectedEl.type === 'text')) && (
          <div data-stop-deselect className="pop-in ed-panel" style={{ width: 360, background: 'var(--white)', overflowY: 'auto', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
            {fxPanel === 'effects' && selectedEl.type === 'text' && (
              <EffectsPanel
                sel={selectedEl as TextEl}
                brandColors={[workspaceData?.primary_color, workspaceData?.secondary_color, workspaceData?.accent_color].filter(Boolean) as string[]}
                onUpdate={(patch) => updateEl(selectedEl.id, patch)}
                onClose={() => setFxPanel(null)}
              />
            )}
            {fxPanel === 'position' && (
              <PositionPanel
                sel={selectedEl}
                stageW={stageW}
                stageH={stageH}
                elements={elements}
                selectedId={selectedId}
                onUpdate={(patch) => updateEl(selectedEl.id, patch)}
                onAlign={alignEl}
                onLayerAction={layerAction}
                onSelect={(id) => setSelectedId(id)}
                onReorderLayers={reorderLayers}
                onClose={() => setFxPanel(null)}
              />
            )}
          </div>
        )}

        {/* ── CANVAS WORKSPACE ── */}
        <div className="ed-canvas-area" style={{ flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'var(--canvas)', position: 'relative' }}>
          {/* Sélecteur caché : sert à remplir une zone photo de modèle. */}
          <input ref={fillPhotoRef} type="file" accept="image/*" onChange={onFillPhoto} style={{ display: 'none' }} />
          {/* ── Barre contextuelle (desktop) — sa PROPRE rangée, au-dessus du plan
               de travail et jamais par-dessus ─────────────────────────────────
               Elle flottait en `position: absolute` sur le haut du plan de
               travail : les poignées hautes d'un objet passaient dessous et
               devenaient impossibles à attraper (redimensionner par le haut
               revenait à cliquer dans la barre). Elle est maintenant un vrai
               bloc du flux : le plan de travail commence dessous.
               La rangée est là même sans sélection — sinon le plan de travail
               sauterait de 62 px à chaque clic sur un objet. */}
          <div className="ed-ctx-row">
          {selectedEl && (
            <div className="ed-ctx-float" data-stop-deselect onMouseDown={e => e.stopPropagation()}
              style={{ maxWidth: '100%' }}>
              <EditorContextToolbar
                sel={toolbarSel ?? selectedEl}
                fontGroups={groupesDePolices}
                brandFamilies={brandFamilies}
                brandColors={[workspaceData?.primary_color, workspaceData?.secondary_color, workspaceData?.accent_color].filter(Boolean) as string[]}
                stageW={stageW}
                stageH={stageH}
                onUpdate={(patch) => updateTextAwareEl(selectedEl, patch)}
                onAlign={alignEl}
                onDuplicate={duplicateEl}
                onDelete={() => deleteEl(selectedId)}
                onCrop={selectedEl.type === 'image' ? () => setCropId(selectedEl.id) : undefined}
                onSetBg={selectedEl.type === 'image' ? () => setProxyUrl((selectedEl as ImageEl).src) : undefined}
                onMaskPhoto={selectedEl.type === 'vector' ? () => maskPhotoInputRef.current?.click() : undefined}
                onRemoveBg={selectedEl.type === 'image' ? () => removeBgFromImage(selectedEl as ImageEl) : undefined}
                bgRemoving={bgRemovingId === selectedEl.id}
                onLayerAction={layerAction}
                onOpenFx={openFxPanel}
                fxPanel={fxPanel}
              />
            </div>
          )}
          </div>
          {(aiBuilding || qaBusy) && (
            <AiGeneratingOverlay title={T('aiComposing')} detail={qaMsg || undefined} lines={edAiLog} />
          )}
          {/* Assistant visuel : consignes en langage naturel, appliquées aux calques. */}
          <AiChatDock
            endpoint="/api/editor-chat"
            labels={{
              title: T('chatTitle'), intro: T('chatIntro'), placeholder: T('chatPlaceholder'),
              newChat: T('chatNewChat'), hint: T('chatHint'),
              thinking: T('chatThinking'), error: T('chatError'),
              open: T('chatOpen'), close: T('chatClose'),
            }}
            openSignal={chatOpenSignal}
            buildProject={buildChatProject}
            applyActions={applyChatActions}
            disabled={qaBusy || aiBuilding}
          />
          <div ref={canvasAreaRef}
          onMouseDown={e => {
            setEditingId(null); setBgCropMode(false); setBgImageSelected(false);
            // Un geste amorcé sur le Stage est déjà géré par Konva : on ne double pas.
            const onStage = !!stageRef.current?.container?.()?.contains(e.target as Node);
            if (onStage) return;
            const start = clientToStage(e.clientX, e.clientY);
            if (!start) { setSelectedId(null); setSelectedIds([]); return; }
            let moved = false;
            const onMove = (ev: MouseEvent) => {
              const p = clientToStage(ev.clientX, ev.clientY);
              if (!p) return;
              if (Math.abs(p.x - start.x) < MARQUEE_THRESHOLD && Math.abs(p.y - start.y) < MARQUEE_THRESHOLD) return;
              moved = true;
              setMarquee({ x: Math.min(start.x, p.x), y: Math.min(start.y, p.y), w: Math.abs(p.x - start.x), h: Math.abs(p.y - start.y) });
            };
            const onUp = () => {
              window.removeEventListener('mousemove', onMove);
              window.removeEventListener('mouseup', onUp);
              if (!moved) { setSelectedId(null); setSelectedIds([]); setMarquee(null); return; }
              endMarquee();
            };
            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
          }}
          onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; if (!isDragOverCanvas) setIsDragOverCanvas(true); }}
          onDragLeave={e => { if (e.currentTarget === e.target) setIsDragOverCanvas(false); }}
          onDrop={handleCanvasDrop}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'safe center', overflow: 'auto', padding: '18px 28px 40px', gap: 40, background: '#F3F4F7', outline: isDragOverCanvas ? '2px solid var(--vio)' : 'none', outlineOffset: -6 }}>
            {slides.map((slide, idx) => {
              const isActive = idx === activeSlideIdx;
              // Carrousel continu : une seule toile large — on masque les autres slides.
              if (isContinuous && !isActive) return null;
              return (
                <div key={slide.id}
                  ref={el => { slideContainerRefs.current[idx] = el; }}
                  style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: (isActive && isContinuous ? stageWView : stageW) * zoom, marginBottom: 8, fontSize: 12, color: 'var(--ink-2)', fontWeight: 700, fontFamily: 'var(--sans)', textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{(isTemplate ? (templateName || 'Template') : (workspaceName || 'Sans titre'))}{slides.length > 1 ? ` — Page ${idx + 1}` : ''}</div>
                  <div style={{ width: (isActive && isContinuous ? stageWView : stageW) * zoom, height: stageH * zoom, position: 'relative', borderRadius: 0, flexShrink: 0,
                    // Décolle la page du fond gris : sans ombre, les deux surfaces
                    // se touchaient et le plan de travail semblait « à plat ».
                    boxShadow: '0 2px 6px rgba(13,15,10,.06), 0 18px 40px -14px rgba(13,15,10,.22)' }}>
                  {isActive ? (
                    <>
                    <div onMouseDown={e => e.stopPropagation()} style={{ position: 'absolute', top: 0, left: 0, width: isContinuous ? stageWView : stageW, height: stageH, transform: `scale(${zoom})`, transformOrigin: 'top left', borderRadius: 0 }}>
            {/* Inner div clips only the Stage canvas */}
            <div style={{ borderRadius: 0, overflow: 'hidden' }}>
            <Stage
              ref={stageRef}
              width={stageWView} height={stageH}
              onMouseDown={e => {
                // Le lasso démarre sur toute zone « vide » : le Stage nu, mais aussi
                // l'image de fond, qui est un nœud à l'écoute et masquerait sinon tout
                // le plan de travail dès qu'une photo est posée.
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                let node: any = e.target;
                while (node && node.getParent && (!node.id || !node.id())) node = node.getParent();
                const nodeId = node && node.id ? node.id() : '';
                const onElement = !!nodeId && elementsRef.current.some(el => el.id === nodeId);
                if (!onElement) beginMarquee(e.target.getStage());
              }}
              onMouseMove={e => updateMarquee(e.target.getStage())}
              onMouseUp={e => {
                const wasMarquee = endMarquee();
                if (wasMarquee) return;
                // Simple clic sur le vide : comportement d'origine.
                if (e.target === e.target.getStage()) {
                  if (cropId) { setCropId(null); }
                  else {
                    setSelectedId(null); setSelectedIds([]);
                    if (!bgLocked && proxyUrl) setBgCropMode(true); else setBgCropMode(false);
                  }
                }
              }}
              onContextMenu={(e: any) => {
                e.evt.preventDefault();
                let node: any = e.target;
                while (node && node.getParent && (!node.id || !node.id())) node = node.getParent();
                const id = node && node.id ? node.id() : '';
                if (id && elementsRef.current.some(el => el.id === id) && !lockedIds.has(id)) {
                  setSelectedId(id);
                  setCtxMenu({ x: e.evt.clientX, y: e.evt.clientY, id });
                } else {
                  setCtxMenu(null);
                }
              }}
              style={{ display: 'block' }}
            >
              <Layer>
                <Rect x={0} y={0} width={stageWView} height={stageH} fill="white" listening={false} />
                {/* Template gradient/solid background — rendered below BgImage */}
                {bgStyle && <BgStyleLayer bgStyle={bgStyle} w={stageWView} h={stageH} />}
                {proxyUrl && (
                  <BgImage
                    src={proxyUrl} w={stageWView} h={stageH}
                    offsetX={bgOffsetX} offsetY={bgOffsetY}
                    draggable={bgCropMode}
                    onDragEnd={(x, y) => { setBgOffsetX(x); setBgOffsetY(y); }}
                    opacity={bgOpacity / 100}
                    onSelect={!bgLocked && !bgCropMode ? () => { setBgImageSelected(true); setSelectedId(null); } : undefined}
                  />
                )}

                {(altGhosts ? [...elements, ...altGhosts] : elements).map(el => {
                  if (hiddenIds.has(el.id)) return null;
                  if (el.type === 'image' && (el as ImageEl).src === PHOTO_PLACEHOLDER_SRC) {
                    const ph = el as ImageEl;
                    return (
                      <Group key={el.id} id={el.id} x={ph.x} y={ph.y} rotation={ph.rotation} opacity={ph.opacity / 100} draggable={!lockedIds.has(el.id)}
                        onClick={e => handleElClick(el.id, e.evt.shiftKey)} onTap={() => handleElClick(el.id, false)}
                        onDblClick={() => openPhotoPicker(el.id)} onDblTap={() => openPhotoPicker(el.id)}
                        onDragStart={() => handleElDragStart(el.id)}
                        onDragMove={e => handleElDragMove(el.id, e)}
                        onDragEnd={e => handleElDragEnd(el.id, e.target.x(), e.target.y())}>
                        {/* Gris OPAQUE : le repère était rempli à 12 % d'opacité,
                            donc la couleur du plan de travail le traversait et la
                            zone devenait invisible sur un fond coloré (rouge, chez
                            Obvisouly Burger). Un aplat neutre montre exactement où
                            la photo se posera, quelle que soit la charte. */}
                        <Rect width={ph.width} height={ph.height} fill="#DDDDD8" stroke="#A9AC9F" strokeWidth={2} cornerRadius={6} />
                        <Text width={ph.width} height={ph.height} text={'\uD83D\uDCF7\n' + T('photoZoneHint')} align="center" verticalAlign="middle" fontSize={16} fontStyle="bold" fill="#6B6F62" fontFamily="var(--sans), sans-serif" listening={false} />
                      </Group>
                    );
                  }
                  if (el.type === 'image') return (
                    <ImgNode key={el.id} el={el} onSelect={sk => handleElClick(el.id, sk)} onChange={u => updateEl(el.id, u)}
                      onDragStart={() => handleElDragStart(el.id)}
                      onDragMove={e => handleElDragMove(el.id, e)}
                      onDragEnd={(x, y) => handleElDragEnd(el.id, x, y)}
                      isCropping={cropId === el.id} locked={lockedIds.has(el.id)} />
                  );
                  if (el.type === 'rect') {
                    const scrimProps = el.scrim
                      ? {
                          fillLinearGradientStartPoint: { x: 0, y: 0 },
                          fillLinearGradientEndPoint: { x: 0, y: el.height },
                          fillLinearGradientColorStops: el.scrim === 'top'
                            ? [0, '#000000', 0.5, 'rgba(0,0,0,0)', 1, 'rgba(0,0,0,0)']
                            : [0, 'rgba(0,0,0,0)', 0.5, 'rgba(0,0,0,0)', 1, '#000000'],
                        }
                      : el.fillType === 'gradient'
                      ? gradientFillProps(el.width, el.height, el.fillAngle ?? 90, el.fill, el.fillTo ?? '#ffffff')
                      : { fill: el.fill };
                    return (
                      <Rect key={el.id} id={el.id} x={el.x} y={el.y} width={el.width} height={el.height}
                        {...scrimProps} stroke={el.stroke} strokeWidth={el.strokeWidth}
                        cornerRadius={Math.max(0, Math.min(el.cornerRadius, el.width / 2, el.height / 2))} rotation={el.rotation} opacity={el.opacity / 100} draggable={!lockedIds.has(el.id)}
                        onClick={e => handleElClick(el.id, e.evt.shiftKey)} onTap={() => handleElClick(el.id, false)}
                        onDragStart={() => handleElDragStart(el.id)}
                        onDragMove={e => handleElDragMove(el.id, e)}
                        onDragEnd={e => handleElDragEnd(el.id, e.target.x(), e.target.y())} />
                    );
                  }
                  if (el.type === 'circle') return (
                    <Circle key={el.id} id={el.id} x={el.x} y={el.y} radius={el.radius}
                      {...(el.fillType === 'gradient' ? gradientFillPropsCentered(el.radius, el.fillAngle ?? 90, el.fill, el.fillTo ?? '#ffffff') : { fill: el.fill })}
                      stroke={el.stroke} strokeWidth={el.strokeWidth}
                      rotation={el.rotation} opacity={el.opacity / 100} draggable={!lockedIds.has(el.id)}
                      onClick={e => handleElClick(el.id, e.evt.shiftKey)} onTap={() => handleElClick(el.id, false)}
                      onDragStart={() => handleElDragStart(el.id)}
                      onDragMove={e => handleElDragMove(el.id, e)}
                      onDragEnd={e => handleElDragEnd(el.id, e.target.x(), e.target.y())} />
                  );
                  if (el.type === 'star') return (
                    <KonvaStar key={el.id} id={el.id} x={el.x} y={el.y} numPoints={el.numPoints}
                      innerRadius={el.innerRadius} outerRadius={el.outerRadius}
                      {...(el.fillType === 'gradient' ? gradientFillPropsCentered(el.outerRadius, el.fillAngle ?? 90, el.fill, el.fillTo ?? '#ffffff') : { fill: el.fill })}
                      stroke={el.stroke} strokeWidth={el.strokeWidth}
                      rotation={el.rotation} opacity={el.opacity / 100} draggable={!lockedIds.has(el.id)}
                      onClick={e => handleElClick(el.id, e.evt.shiftKey)} onTap={() => handleElClick(el.id, false)}
                      onDragStart={() => handleElDragStart(el.id)}
                      onDragMove={e => handleElDragMove(el.id, e)}
                      onDragEnd={e => handleElDragEnd(el.id, e.target.x(), e.target.y())} />
                  );
                  if (el.type === 'vector') return (
                    <VectorNode key={el.id} el={el as VectorEl}
                      onSelect={sk => handleElClick(el.id, sk)}
                      locked={lockedIds.has(el.id)}
                      onDblClick={() => {
                        const v = el as VectorEl;
                        if (v.fillType === 'image' && v.imageSrc) { setMaskCropId(el.id); return; }
                        if (v.shape === 'custom' && v.points && v.points.length >= 2) {
                          // Re-enter pen mode on this element — load its absolute points
                          const absPoints: AnchorPoint[] = v.points.map(p => ({
                            x: p.x + v.x, y: p.y + v.y,
                            ...(p.cpIn  ? { cpIn:  { x: p.cpIn.x  + v.x, y: p.cpIn.y  + v.y } } : {}),
                            ...(p.cpOut ? { cpOut: { x: p.cpOut.x + v.x, y: p.cpOut.y + v.y } } : {}),
                          }));
                          penPointsRef.current = absPoints;
                          setPenPoints([...absPoints]);
                          setIsPenMode(true);
                          setSelectedId(null);
                          applyElements(elementsRef.current.filter(e => e.id !== el.id));
                        }
                      }}
                      onDragStart={() => handleElDragStart(el.id)}
                      onDragMove={e => handleElDragMove(el.id, e)}
                      onDragEnd={(x, y) => handleElDragEnd(el.id, x, y)}
                      isMaskCrop={maskCropId === el.id}
                      onImageOffset={(x, y) => updateEl(el.id, { imageOffsetX: x, imageOffsetY: y } as Partial<VectorEl>)} />
                  );
                  if (el.type === 'text') {
                    const pH = el.paddingH ?? el.padding;
                    const pV = el.paddingV ?? el.padding;
                    const measuredW = measureTextWidth(el.text, el.fontSize, el.fontFamily, el.fontStyle, el.letterSpacing ?? 0);
                    const rawW = el.width ?? (measuredW + pH * 2);
                    // Pas de clamp sur le cadre : un bloc déplacé près d'un bord garde sa
                    // largeur au lieu de se replier. Les marges restent imposées à l'IA par
                    // relayoutText(), qui s'applique aux slots (role) au chargement/format.
                    // Hauteur et largeur du texte viennent du moteur partagé (lib/richText),
                    // le même que celui du cadre de sélection et de l'éditeur : le bloc,
                    // sa hitbox et son aplat suivent donc toujours le texte, y compris sur
                    // plusieurs lignes ou avec des morceaux stylés différemment.
                    const m = measureBlock({ ...el, width: rawW });
                    const blockW = m.blockW;
                    const textAreaW = m.textAreaW;
                    const layout = m.layout;
                    const blockH = m.blockH;
                    // Le fond épouse le texte réellement écrit : élargir la boîte à droite
                    // ne doit plus étirer l'aplat dans le vide. On le recale ensuite selon
                    // l'alignement, comme le fait Konva pour les lignes elles-mêmes.
                    const bgW = Math.min(blockW, layout.maxLineWidth + pH * 2);
                    const bgX = el.align === 'center' ? (blockW - bgW) / 2
                              : el.align === 'right'  ? blockW - bgW
                              : 0;
                    // Pendant l'édition, l'éditeur HTML rend le texte : on masque les
                    // nœuds Konva pour éviter le doublon superposé. Le Rect de fond, lui,
                    // reste peint ici (l'éditeur est transparent).
                    const isEditing = editingId === el.id;
                    // Stylisation partielle : Konva ne sait pas mélanger plusieurs
                    // typographies dans un même nœud Text, on pose donc un nœud par
                    // fragment aux positions calculées par le moteur de mise en page.
                    const hasRuns = !!el.runs?.length;
                    const segNodes = (keyPrefix: string, dx: number, dy: number, extra: (s: ResolvedStyle) => Record<string, unknown>) =>
                      layout.lines.flatMap((line, li) => line.segments.map((seg, si) => (
                        <Text key={`${keyPrefix}-${li}-${si}`}
                          x={pH + dx + seg.x} y={pV + dy + line.top}
                          height={line.height} verticalAlign="bottom" lineHeight={1} wrap="none"
                          text={seg.text}
                          fontSize={seg.style.fontSize} fontFamily={seg.style.fontFamily}
                          fontStyle={seg.style.fontStyle} letterSpacing={seg.style.letterSpacing}
                          listening={false}
                          {...extra(seg.style)} />
                      )));
                    return (
                      <Group key={el.id} id={el.id} x={el.x} y={el.y} rotation={el.rotation} opacity={el.opacity / 100}
                        draggable={!lockedIds.has(el.id)}
                        onClick={e => handleElClick(el.id, e.evt.shiftKey)} onTap={() => handleElClick(el.id, false)}
                        onDblClick={() => { if (!lockedIds.has(el.id)) { setSelectedId(el.id); setEditingId(el.id); } }}
                        onDragStart={() => handleElDragStart(el.id)}
                        onDragMove={e => handleElDragMove(el.id, e)}
                        onDragEnd={e => handleElDragEnd(el.id, e.target.x(), e.target.y())}>
                        {/* Bug 5 fix: always keep Rect clickable via hitFunc; fully invisible when hasBg=false (no faint opacity box on visuals) */}
                        <Rect x={el.hasBg ? bgX : 0} y={0} width={el.hasBg ? bgW : blockW} height={blockH}
                          fill={el.hasBg ? el.bgColor : undefined}
                          opacity={el.hasBg ? el.bgOpacity / 100 : 1}
                          cornerRadius={el.hasBg ? el.cornerRadius : 0}
                          hitFunc={(ctx, shape) => {
                            // La zone cliquable reste le bloc entier même quand l'aplat est
                            // plus étroit : coordonnées locales au Rect, donc décalées de bgX.
                            ctx.beginPath();
                            ctx.rect(el.hasBg ? -bgX : 0, 0, blockW, blockH);
                            ctx.closePath();
                            ctx.fillStrokeShape(shape);
                          }}
                        />
                        {/* Surbrillance — highlight rect behind text */}
                        {el.highlightEnabled && !isEditing && (() => {
                          const hp = el.highlightPadding ?? 8;
                          // UN APLAT PAR LIGNE, chacun épousant SA ligne.
                          //
                          // Il n'y en avait qu'un, calé sur `textAreaW` : élargir
                          // la boîte l'étirait dans le vide, et un texte passant à
                          // la ligne laissait la deuxième sans fond du tout. Chaque
                          // ligne a sa propre largeur dans le moteur de mise en
                          // page — on s'en sert, et on recale selon l'alignement.
                          return (
                            <>
                              {layout.lines.map((line, li) => {
                                if (!line.width) return null;   // ligne vide : pas d'aplat
                                const x = el.align === 'center' ? pH + (textAreaW - line.width) / 2 - hp
                                        : el.align === 'right'  ? pH + textAreaW - line.width - hp
                                        : pH - hp;
                                // La MARGE EST LA MÊME PARTOUT — hp de chaque côté.
                                //
                                // La hauteur était calée sur `line.height`, qui
                                // englobe l'interligne : le blanc de l'interligne
                                // s'ajoutait donc sous le texte, et l'aplat semblait
                                // plus large en bas qu'ailleurs. On le cale sur la
                                // hauteur du TEXTE, que Konva pose au bas de sa
                                // ligne (verticalAlign="bottom").
                                const textH = line.segments.reduce((h, sg) => Math.max(h, sg.style.fontSize), el.fontSize);
                                // La taille de police n'est pas la hauteur des LETTRES :
                                // elle réserve de la place au-dessus des capitales et
                                // en dessous de la ligne d'écriture, pour les jambages
                                // (« p », « g »). Caler l'aplat dessus laissait donc un
                                // vide sous un mot tout en capitales, qui n'a aucun
                                // jambage — d'où la marge plus grande en bas.
                                // On encadre les capitales : ~12 % au-dessus de la ligne
                                // d'écriture, ~80 % en dessous du haut du cadre.
                                const capTop = textH * 0.12;
                                const capH = textH * 0.68;
                                const emTop = pV + line.top + line.height - textH;
                                const textTop = emTop + capTop;
                                return (
                                  <Rect
                                    key={`hl-${li}`}
                                    x={x} y={textTop - hp}
                                    width={line.width + hp * 2}
                                    height={capH + hp * 2}
                                    fill={el.highlightColor ?? '#FFFF00'}
                                    opacity={(el.highlightOpacity ?? 80) / 100}
                                    cornerRadius={el.highlightBorderRadius ?? 4}
                                    listening={false}
                                  />
                                );
                              })}
                            </>
                          );
                        })()}
                        {/* Élévation — lift layers rendered deepest */}
                        {el.liftEnabled && !isEditing && (() => {
                          const depth = el.liftDepth ?? 6;
                          const dirMap: Record<string,[number,number]> = { tl:[-1,-1],t:[0,-1],tr:[1,-1],l:[-1,0],r:[1,0],bl:[-1,1],b:[0,1],br:[1,1] };
                          const [dx,dy] = dirMap[el.liftDirection ?? 'br'] ?? [1,1];
                          const txt = el.uppercase ? el.text.toUpperCase() : el.text;
                          if (hasRuns) return Array.from({ length: depth }, (_,i) =>
                            segNodes(`lift-${i}`, dx*(depth-i), dy*(depth-i), () => ({ fill: el.liftColor ?? '#333333' })));
                          return Array.from({ length: depth }, (_,i) => (
                            <Text key={`lift-${i}`} x={pH + dx*(depth-i)} y={pV + dy*(depth-i)} width={textAreaW} wrap="word"
                              text={txt} fontSize={el.fontSize} fontFamily={el.fontFamily} fontStyle={el.fontStyle}
                              fill={el.liftColor ?? '#333333'} align={el.align} listening={false}
                              lineHeight={el.lineHeight ?? 1.2} letterSpacing={el.letterSpacing ?? 0} />
                          ));
                        })()}
                        {/* Écho — echo layers behind main text */}
                        {el.echoEnabled && !isEditing && (() => {
                          const count = el.echoCount ?? 3;
                          const offset = el.echoOffset ?? 8;
                          const fade = el.echoFade !== false;
                          const txt = el.uppercase ? el.text.toUpperCase() : el.text;
                          if (hasRuns) return Array.from({ length: count }, (_,i) =>
                            segNodes(`echo-${i}`, offset*(count-i), offset*(count-i), () => ({
                              fill: el.echoColor ?? '#FF69B4',
                              opacity: fade ? 1 / Math.pow(2, count-i) : 0.5,
                            })));
                          return Array.from({ length: count }, (_,i) => (
                            <Text key={`echo-${i}`} x={pH + offset*(count-i)} y={pV + offset*(count-i)} width={textAreaW} wrap="word"
                              text={txt} fontSize={el.fontSize} fontFamily={el.fontFamily} fontStyle={el.fontStyle}
                              fill={el.echoColor ?? '#FF69B4'}
                              opacity={fade ? 1 / Math.pow(2, count-i) : 0.5}
                              align={el.align} listening={false}
                              lineHeight={el.lineHeight ?? 1.2} letterSpacing={el.letterSpacing ?? 0} />
                          ));
                        })()}
                        {/* Lueur — glow Text clone rendered behind main text */}
                        {el.glowEnabled && !isEditing && hasRuns && segNodes('glow', 0, 0, () => ({
                          fill: 'transparent',
                          shadowEnabled: true,
                          shadowColor: el.glowColor ?? '#00FFFF',
                          shadowOpacity: (el.glowIntensity ?? 50) / 100,
                          shadowBlur: el.glowSize ?? 10,
                          shadowOffsetX: 0,
                          shadowOffsetY: 0,
                        }))}
                        {el.glowEnabled && !isEditing && !hasRuns && (
                          <Text x={pH} y={pV} width={textAreaW} wrap="word"
                            text={el.uppercase ? el.text.toUpperCase() : el.text}
                            fontSize={el.fontSize} fontFamily={el.fontFamily}
                            fontStyle={el.fontStyle}
                            fill="transparent"
                            align={el.align} listening={false}
                            lineHeight={el.lineHeight ?? 1.2}
                            letterSpacing={el.letterSpacing ?? 0}
                            shadowEnabled={true}
                            shadowColor={el.glowColor ?? '#00FFFF'}
                            shadowOpacity={(el.glowIntensity ?? 50) / 100}
                            shadowBlur={el.glowSize ?? 10}
                            shadowOffsetX={0}
                            shadowOffsetY={0}
                          />
                        )}
                        {/* text wraps within blockW; handles update el.width which drives blockW */}
                        {hasRuns && !isEditing && segNodes('seg', 0, 0, s => ({
                          textDecoration: s.textDecoration,
                          ...(el.hollowEnabled
                            ? { fill: 'transparent' }
                            : el.fillType === 'gradient'
                            ? gradientFillProps(blockW, blockH, el.fillAngle ?? 90, el.fill, el.fillTo ?? '#ffffff')
                            : { fill: s.fill }),
                          shadowEnabled: el.shadowEnabled ?? false,
                          shadowColor: el.shadowColor ?? '#000000',
                          shadowOpacity: (el.shadowOpacity ?? 75) / 100,
                          shadowBlur: el.shadowBlur ?? 5,
                          shadowOffsetX: el.shadowOffsetX ?? 2,
                          shadowOffsetY: el.shadowOffsetY ?? 2,
                          stroke: el.hollowEnabled ? (el.stroke ?? s.fill) : (el.strokeWidth ? (el.stroke ?? '#000000') : ''),
                          strokeWidth: el.hollowEnabled ? Math.max(el.strokeWidth ?? 0, 1) : (el.strokeWidth ?? 0),
                        }))}
                        <Text x={pH} y={pV} width={textAreaW} wrap="word" visible={!isEditing && !hasRuns}
                          text={el.uppercase ? el.text.toUpperCase() : el.text}
                          fontSize={el.fontSize} fontFamily={el.fontFamily}
                          fontStyle={el.fontStyle} textDecoration={el.textDecoration}
                          {...(el.hollowEnabled
                            ? { fill: 'transparent' }
                            : el.fillType === 'gradient'
                            ? gradientFillProps(blockW, blockH, el.fillAngle ?? 90, el.fill, el.fillTo ?? '#ffffff')
                            : { fill: el.fill })}
                          align={el.align} listening={false}
                          lineHeight={el.lineHeight ?? 1.2}
                          letterSpacing={el.letterSpacing ?? 0}
                          shadowEnabled={el.shadowEnabled ?? false}
                          shadowColor={el.shadowColor ?? '#000000'}
                          shadowOpacity={(el.shadowOpacity ?? 75) / 100}
                          shadowBlur={el.shadowBlur ?? 5}
                          shadowOffsetX={el.shadowOffsetX ?? 2}
                          shadowOffsetY={el.shadowOffsetY ?? 2}
                          stroke={el.hollowEnabled ? (el.stroke ?? el.fill) : (el.strokeWidth ? (el.stroke ?? '#000000') : '')}
                          strokeWidth={el.hollowEnabled ? Math.max(el.strokeWidth ?? 0, 1) : (el.strokeWidth ?? 0)}
                        />
                      </Group>
                    );
                  }
                  return null;
                })}

                {showGrid && (
                  <>
                    {Array.from({ length: 9 }).map((_, i) => {
                      const gx = (stageW * (i + 1)) / 10;
                      return <Line key={`gv${i}`} points={[gx, 0, gx, stageH]} stroke="rgba(47,215,155,0.16)" strokeWidth={1} listening={false} />;
                    })}
                    {Array.from({ length: 9 }).map((_, i) => {
                      const gy = (stageH * (i + 1)) / 10;
                      return <Line key={`gh${i}`} points={[0, gy, stageW, gy]} stroke="rgba(47,215,155,0.16)" strokeWidth={1} listening={false} />;
                    })}
                  </>
                )}
                {guides.v !== null && (
                  <Line points={[guides.v, 0, guides.v, stageH]} stroke="#FF5DA2" strokeWidth={1} listening={false} />
                )}
                {guides.h !== null && (
                  <Line points={[0, guides.h, stageW, guides.h]} stroke="#FF5DA2" strokeWidth={1} listening={false} />
                )}

              </Layer>
            </Stage>
            </div>{/* end inner overflow:hidden */}

            {/* ── Pen tool overlay ── */}
            {isPenMode && (
              <svg
                style={{ position: 'absolute', top: 0, left: 0, width: stageW, height: stageH, cursor: 'crosshair', zIndex: 25, overflow: 'visible' }}
                onMouseDown={handlePenMouseDown}
                onMouseMove={handlePenMouseMove}
                onMouseUp={handlePenMouseUp}
                onDoubleClick={handlePenDblClick}
              >
                {/* transparent hit region for the full canvas */}
                <rect x={0} y={0} width={stageW} height={stageH} fill="transparent" />
                {/* drawn path so far */}
                {penPoints.length >= 2 && (
                  <path d={buildSvgPath(penPoints, false)} fill="rgba(47,215,155,0.10)" stroke="#2FD79B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                )}
                {/* Live Bézier preview during click+drag (before mouseup) */}
                {penDragOriginRef.current && penIsDraggingRef.current && penPreviewPos && (() => {
                  const origin = penDragOriginRef.current!;
                  const dx = penPreviewPos.x - origin.x;
                  const dy = penPreviewPos.y - origin.y;
                  const cpOut = { x: origin.x + dx, y: origin.y + dy };
                  const cpIn  = { x: origin.x - dx, y: origin.y - dy };
                  const last  = penPoints.length >= 1 ? penPoints[penPoints.length - 1] : null;
                  return (
                    <g>
                      {/* Handle line */}
                      <line x1={cpIn.x} y1={cpIn.y} x2={cpOut.x} y2={cpOut.y} stroke="#2FD79B" strokeWidth="1" opacity="0.6" />
                      <circle cx={cpOut.x} cy={cpOut.y} r={3.5} fill="#2FD79B" />
                      <circle cx={cpIn.x} cy={cpIn.y} r={3.5} fill="#2FD79B" />
                      {/* Provisional anchor */}
                      <circle cx={origin.x} cy={origin.y} r={5} fill="#fff" stroke="#2FD79B" strokeWidth="1.8" />
                      {/* Bezier from last point to provisional anchor using handles */}
                      {last && (
                        <path d={`M ${last.x} ${last.y} C ${(last.cpOut ?? last).x} ${(last.cpOut ?? last).y} ${cpIn.x} ${cpIn.y} ${origin.x} ${origin.y}`}
                          fill="none" stroke="#2FD79B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      )}
                    </g>
                  );
                })()}
                {/* Straight preview line from last anchor to cursor (when not dragging) */}
                {penPreviewPos && penPoints.length >= 1 && !penIsDraggingRef.current && (() => {
                  const last = penPoints[penPoints.length - 1];
                  const cp1 = last.cpOut ?? last;
                  return (
                    <path d={`M ${last.x} ${last.y} C ${cp1.x} ${cp1.y} ${penPreviewPos.x} ${penPreviewPos.y} ${penPreviewPos.x} ${penPreviewPos.y}`}
                      fill="none" stroke="#2FD79B" strokeWidth="1" strokeDasharray="5 4" opacity="0.55" />
                  );
                })()}
                {/* anchor points + Bézier handles */}
                {penPoints.map((p, i) => (
                  <g key={i}>
                    {p.cpOut && (
                      <>
                        <line x1={p.x} y1={p.y} x2={p.cpOut.x} y2={p.cpOut.y} stroke="#2FD79B" strokeWidth="1" opacity="0.5" />
                        <circle cx={p.cpOut.x} cy={p.cpOut.y} r={3.5} fill="#2FD79B" />
                      </>
                    )}
                    {p.cpIn && (
                      <>
                        <line x1={p.x} y1={p.y} x2={p.cpIn.x} y2={p.cpIn.y} stroke="#2FD79B" strokeWidth="1" opacity="0.5" />
                        <circle cx={p.cpIn.x} cy={p.cpIn.y} r={3.5} fill="#2FD79B" />
                      </>
                    )}
                    <circle
                      cx={p.x} cy={p.y}
                      r={i === 0 && penPoints.length >= 3 ? 8 : 5}
                      fill={i === 0 ? 'rgba(47,215,155,0.18)' : '#fff'}
                      stroke="#2FD79B" strokeWidth="1.8"
                      style={{ cursor: i === 0 && penPoints.length >= 3 ? 'pointer' : 'crosshair' }}
                    />
                    {i === 0 && penPoints.length >= 3 && (
                      <circle cx={p.x} cy={p.y} r={3} fill="#2FD79B" />
                    )}
                  </g>
                ))}
              </svg>
            )}

            {/* pen mode hint bar */}
            {isPenMode && (
              <div style={{ position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)', zIndex: 26, background: 'rgba(12,42,29,0.82)', backdropFilter: 'blur(6px)', borderRadius: 10, padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 18px rgba(13,15,10,.38)', fontSize: 12, color: 'rgba(238,237,227,0.75)', fontFamily: 'var(--sans)', pointerEvents: 'none', whiteSpace: 'nowrap' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2FD79B" strokeWidth="2.2" strokeLinecap="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/></svg>
                <span><b style={{ color: '#eeeee0' }}>{T('click')}</b> — ancre &middot; <b style={{ color: '#eeeee0' }}>{T('clickDrag')}</b> — courbe &middot; <b style={{ color: '#eeeee0' }}>{T('dblClick')}</b> — terminer &middot; <b style={{ color: '#eeeee0' }}>{T('escape')}</b> — annuler{penPoints.length >= 3 && <> &middot; <b style={{ color: '#2FD79B' }}>1er point</b> — fermer</>}</span>
              </div>
            )}

            {/* Carrousel continu — repères de découpe entre volets (overlay HTML, jamais exporté) */}
            {isContinuous && Array.from({ length: contPanels }).map((_, i) => (
              <div key={`cut-${i}`} style={{ position: 'absolute', top: 0, left: i * stageW, width: stageW, height: stageH, pointerEvents: 'none', zIndex: 8,
                borderRight: i < contPanels - 1 ? '2px solid rgba(47,215,155,.85)' : 'none' }}>
                <div style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(12,42,29,.82)', color: '#eeeee0', fontSize: 22, fontWeight: 800, fontFamily: 'var(--mono)', padding: '4px 12px', borderRadius: 8 }}>{i + 1}</div>
              </div>
            ))}

            {/* BG image selected — selection border + opacity pill */}
            {bgImageSelected && (
              <div onMouseDown={e => e.stopPropagation()} style={{ position: 'absolute', inset: 0, borderRadius: 0, border: '2px solid var(--vio)', pointerEvents: 'none', zIndex: 10 }} />
            )}
            {bgImageSelected && (
              <div onMouseDown={e => e.stopPropagation()} style={{ position: 'absolute', top: -50, left: '50%', transform: 'translateX(-50%)', zIndex: 20, background: '#fff', borderRadius: 11, padding: '6px 12px', boxShadow: '0 8px 24px -8px rgba(13,15,10,.3), 0 0 0 1px rgba(13,15,10,.06)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)' }}>{T('bgOpacity')}</span>
                <input type="range" min={10} max={100} value={bgOpacity} onChange={e => setBgOpacity(Number(e.target.value))} style={{ width: 80, accentColor: 'var(--vio)' }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', minWidth: 28, fontVariantNumeric: 'tabular-nums' }}>{bgOpacity}%</span>
                <span style={{ width: 1, height: 18, background: 'var(--line)', flexShrink: 0 }} />
                <button onClick={detachBgToElement}
                  title="Sortir l'image du fond pour la manipuler comme un objet"
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 9px', border: '1px solid var(--line)', background: 'transparent', cursor: 'pointer', color: 'var(--ink-2)', borderRadius: 6, fontSize: 11.5, fontWeight: 700, fontFamily: 'var(--sans)', whiteSpace: 'nowrap' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3H5a2 2 0 0 0-2 2v4"/><path d="M15 21h4a2 2 0 0 0 2-2v-4"/><rect x="8" y="8" width="13" height="13" rx="2"/></svg>
                  Libérer du fond
                </button>
                <button onClick={() => { setProxyUrl(''); setBgImageSelected(false); }} style={{ width: 22, height: 22, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ink-3)', display: 'grid', placeItems: 'center', borderRadius: 5 }}
                  title={T('removeBackground')}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            )}
            {marquee && (
              <div style={{
                position: 'absolute',
                left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h,
                background: 'rgba(124,92,255,0.12)',
                border: '1px solid #7C5CFF',
                pointerEvents: 'none', zIndex: 11,
              }} />
            )}
            {/* Sélection multiple : contour de chaque objet + cadre de groupe redimensionnable */}
            {selectedIds.length > 1 && !isKonvaDragging && (() => {
              const sels = elements.filter(e => selectedIds.includes(e.id) && !hiddenIds.has(e.id));
              if (sels.length < 2) return null;
              const boxes = sels.map(e => ({ id: e.id, box: getElBox(e) }));
              const minX = Math.min(...boxes.map(b => b.box.l));
              const minY = Math.min(...boxes.map(b => b.box.t));
              const maxX = Math.max(...boxes.map(b => b.box.r));
              const maxY = Math.max(...boxes.map(b => b.box.b));
              const pad = 6;
              const groupBox = { l: minX, t: minY, r: maxX, b: maxY };
              const corners: { id: string; cursor: string; style: React.CSSProperties }[] = [
                { id: 'tl', cursor: 'nw-resize', style: { left: -6, top: -6 } },
                { id: 'tr', cursor: 'ne-resize', style: { right: -6, top: -6 } },
                { id: 'bl', cursor: 'sw-resize', style: { left: -6, bottom: -6 } },
                { id: 'br', cursor: 'se-resize', style: { right: -6, bottom: -6 } },
              ];
              return (
                <>
                  {/* Contour léger par objet : on voit lesquels sont pris dans la sélection */}
                  {boxes.map(b => (
                    <div key={`selbox-${b.id}`} style={{
                      position: 'absolute',
                      left: b.box.l, top: b.box.t,
                      width: Math.max(1, b.box.r - b.box.l), height: Math.max(1, b.box.b - b.box.t),
                      border: '1.5px solid var(--vio)',
                      borderRadius: 2,
                      opacity: 0.55,
                      pointerEvents: 'none',
                      zIndex: 9,
                    }} />
                  ))}
                  {/* Cadre du groupe + poignées d'échelle */}
                  <div style={{
                    position: 'absolute',
                    left: minX - pad, top: minY - pad,
                    width: maxX - minX + pad * 2, height: maxY - minY + pad * 2,
                    border: '2px solid var(--vio)',
                    borderRadius: 4,
                    pointerEvents: 'none',
                    zIndex: 10,
                  }}>
                    {corners.map(c => (
                      <div
                        key={c.id}
                        onMouseDown={startGroupResize(c.id, groupBox)}
                        title="Redimensionner la sélection"
                        style={{
                          position: 'absolute',
                          width: 14, height: 14,
                          background: '#FFFFFF',
                          border: '1.5px solid var(--vio)',
                          borderRadius: 3,
                          boxShadow: '0 1px 3px rgba(13,15,10,.22)',
                          cursor: c.cursor,
                          pointerEvents: 'auto',
                          ...c.style,
                        }}
                      />
                    ))}
                  </div>
                </>
              );
            })()}
            {selectedEl && selectedIds.length <= 1 && !hiddenIds.has(selectedEl.id) && !isKonvaDragging && cropId !== selectedEl.id && maskCropId !== selectedEl.id && (
              <>
                <SelectionOverlay
                  el={selectedEl}
                  stageRef={stageRef}
                  onChange={u => {
                    // Live update — no history push per frame
                    const newEls = elementsRef.current.map(e =>
                      e.id === selectedEl.id ? { ...e, ...u } as CanvasEl : e
                    );
                    setElements(newEls);
                  }}
                  onDragEnd={() => {
                    // Commit a single undo entry when drag ends
                    const slice = historyRef.current.slice(0, histIdxRef.current + 1);
                    historyRef.current = [...slice, { slide: activeSlideIdxRef.current, els: elementsRef.current }];
                    histIdxRef.current = historyRef.current.length - 1;
                    setHistTick(t => t + 1);
                  }}
                  zoom={zoom}
                />
                {(() => {
                  // Même géométrie que le cadre de sélection, rotation comprise.
                  const half = (('width' in selectedEl ? (selectedEl as any).width : ('radius' in selectedEl ? (selectedEl as any).radius * 2 : ('outerRadius' in selectedEl ? (selectedEl as any).outerRadius * 2 : 100))) ?? 100) / 2;
                  const rect = getVisualRect(selectedEl as any) ?? {
                    left: selectedEl.x - half, top: selectedEl.y,
                    right: selectedEl.x + half, bottom: selectedEl.y,
                  };
                  return (
                    <SelectionPill
                      rect={rect}
                      zoom={zoom}
                      onDuplicate={duplicateEl}
                      onDelete={() => deleteEl(selectedId)}
                      onAsk={() => setChatOpenSignal(n => n + 1)}
                    />
                  );
                })()}
              </>
            )}
            {editingId && (() => {
              const tel = elements.find(e => e.id === editingId) as TextEl | undefined;
              if (!tel || tel.type !== 'text') return null;
              return (
                <RichTextOverlay
                  key={editingId}
                  ref={richRef}
                  el={tel}
                  keepOpenSelector={KEEP_TEXT_EDIT_SELECTOR}
                  onRangeChange={setTextRange}
                  onChange={patch => {
                    const newEls = elementsRef.current.map(e =>
                      e.id === editingId ? { ...e, ...patch } as CanvasEl : e
                    );
                    setElements(newEls);
                    elementsRef.current = newEls;
                  }}
                  onCommit={commitTextEdit}
                  onExit={() => { setEditingId(null); setTextRange(null); }}
                />
              );
            })()}
            {maskCropId && (
              <div style={{ position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 8, zIndex: 20, pointerEvents: 'auto' }}>
                <div style={{ background: 'rgba(12,42,29,0.82)', backdropFilter: 'blur(6px)', borderRadius: 10, padding: '6px 8px', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 18px rgba(13,15,10,.38)', fontSize: 12, color: 'rgba(238,237,227,0.7)', fontFamily: 'var(--sans)' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2FD79B" strokeWidth="2.2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  Glissez la photo dans la forme
                  <button onClick={() => setMaskCropId(null)} style={{ padding: '5px 14px', background: '#2FD79B', color: '#0C2A1D', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'var(--sans)' }}>
                    Appliquer
                  </button>
                </div>
              </div>
            )}
            {cropId && (
              <div style={{
                position: 'absolute', bottom: 14, left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex', gap: 8, zIndex: 20, pointerEvents: 'auto',
              }}>
                <div style={{
                  background: 'rgba(12,42,29,0.82)', backdropFilter: 'blur(6px)',
                  borderRadius: 10, padding: '6px 8px',
                  display: 'flex', alignItems: 'center', gap: 8,
                  boxShadow: '0 4px 18px rgba(13,15,10,.38)',
                  fontSize: 12, color: 'rgba(238,237,227,0.7)', fontFamily: 'var(--sans)',
                }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2FD79B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
                    <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
                  </svg>
                  Glissez pour recadrer
                  <button onClick={() => setCropId(null)} style={{
                    padding: '5px 14px', background: '#2FD79B', color: '#0C2A1D',
                    border: 'none', borderRadius: 6, cursor: 'pointer',
                    fontSize: 12, fontWeight: 700, fontFamily: 'var(--sans)',
                  }}>
                    Appliquer
                  </button>
                </div>
              </div>
            )}
            </div>
                    </>
                  ) : (
                    <div onClick={() => switchSlide(idx)}
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', borderRadius: 0, overflow: 'hidden', cursor: 'pointer', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {slide.thumbnail ? (
                        <img src={slide.thumbnail} alt={`Slide ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      ) : (
                        <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, fontSize: Math.max(14, Math.round(18 * zoom)), color: 'var(--ink-3)', opacity: 0.4 }}>{idx + 1}</span>
                      )}
                    </div>
                  )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── ZOOM BADGE ── */}
          <div style={{
            position: 'absolute', bottom: 144, right: 14, zIndex: 50,
            background: 'rgba(12,42,29,0.82)', backdropFilter: 'blur(6px)',
            borderRadius: 8, padding: '5px 10px',
            display: 'flex', alignItems: 'center', gap: 8,
            boxShadow: '0 2px 8px rgba(13,15,10,.3)',
            fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 12,
            color: zoom !== 1 ? 'var(--leaf)' : 'rgba(238,237,227,0.55)',
            pointerEvents: 'auto',
          }}>
            {Math.round(zoom * 100)}%
            {zoom !== 1 && (
              <button
                onClick={() => setZoom(1)}
                style={{
                  background: 'rgba(47,215,155,.18)', border: 'none', borderRadius: 4,
                  color: 'var(--mint)', padding: '2px 7px',
                  fontSize: 10, fontWeight: 800, cursor: 'pointer', fontFamily: 'var(--mono)',
                  letterSpacing: '.04em',
                }}
              >
                Reset
              </button>
            )}
          </div>

          {/* ── BARRE DU BAS ──
              Refonte façon Canva : les commandes de zoom vivent dans UN bloc
              groupé au lieu d'être une file de puces isolées, et l'indicateur de
              page devient un vrai sélecteur. La barre est blanche pour se
              détacher du plan de travail, désormais gris. */}
          <div style={{
            height: 52, flexShrink: 0,
            background: 'transparent',
            display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px',
          }}>
            {/* Page courante + format */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <span style={{ display: 'grid', placeItems: 'center', width: 28, height: 28, borderRadius: 8, background: 'var(--sunk)', color: 'var(--ink-2)', flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="M21 16l-5-5L5 20"/></svg>
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2, minWidth: 0 }}>
                <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--ink)', whiteSpace: 'nowrap' }}>
                  Page {activeSlideIdx + 1}{slides.length > 1 ? ` / ${slides.length}` : ''}
                </span>
                <span style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {activeFormat.label} · {workspaceName}
                </span>
              </div>
            </div>

            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
              <button className="btn btn-sm btn-ghost" style={{ height: 34 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M5 12a7 7 0 0 1 7-7M19 12a7 7 0 0 1-7 7"/><path d="M12 5l-2.4 1.4M12 5l2.4 1.4M12 19l-2.4-1.4M12 19l2.4-1.4"/></svg>
                Animer
              </button>

              {/* Bloc de zoom groupé — c'est lui qui faisait « suite de puces » */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--sunk)', borderRadius: 'var(--r-btn)', padding: '3px 5px' }}>
                <button onClick={() => setZoom(z => Math.max(0.15, +(z - 0.1).toFixed(2)))} title="Dézoomer"
                  style={{ width: 28, height: 28, borderRadius: '50%', display: 'grid', placeItems: 'center', color: 'var(--ink-2)', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 12h14"/></svg>
                </button>
                <input type="range" min={0.15} max={3} step={0.01} value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="ed-range" style={{ width: 116, ...rangeFill(zoom, 0.15, 3) }} />
                <button onClick={() => setZoom(z => Math.min(3, +(z + 0.1).toFixed(2)))} title="Zoomer"
                  style={{ width: 28, height: 28, borderRadius: '50%', display: 'grid', placeItems: 'center', color: 'var(--ink-2)', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                </button>
                <button onClick={() => setZoom(1)} title="Revenir à 100 %"
                  style={{ minWidth: 46, height: 28, borderRadius: 'var(--r-btn)', border: 'none', cursor: 'pointer', background: 'var(--white)', color: 'var(--ink)', fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 11.5, fontVariantNumeric: 'tabular-nums', boxShadow: '0 1px 2px rgba(13,15,10,.10)' }}>
                  {Math.round(zoom * 100)}%
                </button>
              </div>

              <span style={{ width: 1, height: 22, background: 'var(--line)', flexShrink: 0 }} />

              <button onClick={fit} title={T('adjust')} className="btn btn-sm btn-ghost btn-icon" style={{ height: 34, width: 34 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
              </button>
              <button onClick={() => setShowGrid(g => !g)} title={showGrid ? 'Masquer la grille' : 'Afficher la grille'} className="btn btn-sm btn-ghost btn-icon"
                style={{ height: 34, width: 34, background: showGrid ? 'var(--mint-soft)' : undefined, color: showGrid ? 'var(--mint-2)' : undefined }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/></svg>
              </button>
            </div>
          </div>

          {/* ── SLIDE STRIP ── (masqué en carrousel continu : une seule toile) */}
          <div style={{
            height: 80, flexShrink: 0,
            background: '#F3F4F7',
            display: isContinuous ? 'none' : 'flex', alignItems: 'center',
            padding: '0 16px', gap: 8,
            overflowX: 'auto',
          }}>
            {/* Rappel du contrat : ajouter une page suffit à faire un carrousel —
                il n'y a plus de type « carrousel » à choisir avant de dessiner. */}
            <div style={{ flexShrink: 0, marginRight: 4, lineHeight: 1.25 }}>
              <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--ink-2)', fontFamily: 'var(--sans)', whiteSpace: 'nowrap' }}>
                {slides.length > 1 && canBeCarousel ? `Carrousel · ${slides.length} pages` : 'Pages'}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>
                {postType === 'story'
                  ? 'Une story = une image'
                  : slides.length > 1 ? 'Glissez une page pour changer l’ordre' : 'Ajoutez une page pour un carrousel'}
              </div>
            </div>
            {slides.map((slide, idx) => {
              const isActive = idx === activeSlideIdx;
              const isDropTarget = slideDragIdx !== null && slideDragOverIdx === idx && slideDragIdx !== idx;
              return (
                <div key={slide.id}
                  style={{
                    position: 'relative', flexShrink: 0,
                    opacity: slideDragIdx === idx ? 0.4 : 1,
                    // Repère d'insertion : on voit OÙ la page va tomber.
                    borderLeft: isDropTarget && idx < (slideDragIdx ?? 0) ? '3px solid var(--mint-2)' : '3px solid transparent',
                    borderRight: isDropTarget && idx > (slideDragIdx ?? 0) ? '3px solid var(--mint-2)' : '3px solid transparent',
                    transition: 'opacity .12s',
                  }}
                  onDragOver={e => { if (slideDragIdx !== null) { e.preventDefault(); setSlideDragOverIdx(idx); } }}
                  onDrop={e => { e.preventDefault(); moveSlide(slideDragIdx, idx); }}
                >
                  <button
                    draggable={slides.length > 1}
                    onDragStart={e => { setSlideDragIdx(idx); e.dataTransfer.effectAllowed = 'move'; }}
                    onDragEnd={() => { setSlideDragIdx(null); setSlideDragOverIdx(null); }}
                    onClick={() => switchSlide(idx)}
                    style={{
                      width: 46, height: 58, borderRadius: 7,
                      border: `2px solid ${isActive ? 'var(--mint-2)' : 'var(--line)'}`,
                      background: 'var(--white)',
                      cursor: 'pointer', padding: 0, overflow: 'hidden',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'border-color .12s',
                      boxShadow: isActive ? '0 0 0 3px var(--mint-soft)' : 'none',
                      position: 'relative',
                    }}
                  >
                    {slide.thumbnail && !isActive ? (
                      <img src={slide.thumbnail} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', borderRadius: 5 }} />
                    ) : null}
                    <span style={{
                      fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 12,
                      color: isActive ? 'var(--mint-2)' : (slide.thumbnail ? 'rgba(255,255,255,.85)' : 'var(--ink-3)'),
                      position: 'relative', zIndex: 1,
                      textShadow: slide.thumbnail && !isActive ? '0 1px 3px rgba(0,0,0,.5)' : 'none',
                    }}>{idx + 1}</span>
                    {slide.spanGroupId && (
                      <span title={T('partOfLinkedCarousel')} style={{ position: 'absolute', bottom: 3, left: 3, zIndex: 1, width: 14, height: 14, borderRadius: 4, background: 'rgba(0,0,0,.45)', display: 'grid', placeItems: 'center' }}>
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><path d="M9 17H7A5 5 0 0 1 7 7h2M15 7h2a5 5 0 1 1 0 10h-2M8 12h8"/></svg>
                      </span>
                    )}
                  </button>
                  {slides.length > 1 && (
                    <button
                      onClick={() => removeSlide(idx)}
                      style={{
                        position: 'absolute', top: -5, right: -5,
                        width: 16, height: 16, borderRadius: '50%',
                        background: 'var(--ink)', color: 'var(--paper)',
                        border: 'none', cursor: 'pointer', padding: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 700, lineHeight: 1,
                      }}
                    >×</button>
                  )}
                </div>
              );
            })}
            {postType !== 'story' && (
            <button
              onClick={addSlide}
              style={{
                width: 46, height: 58, borderRadius: 7, flexShrink: 0,
                border: '1.5px solid var(--line)',
                background: 'transparent',
                cursor: 'pointer', padding: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--ink-3)', fontSize: 20, fontWeight: 300,
              }}
            >+</button>
            )}
          </div>
        </div>

      </div>

      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileUpload} />
      <input ref={maskPhotoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleMaskPhotoUpload} />
    </div>

    {/* ── BIBLIOTHÈQUE DE TEXTES — modale plein écran regroupant TOUS les templates ── */}
    {textLibOpen && (() => {
      const q = textLibQuery.trim().toLowerCase();
      const filtered = TEXT_TEMPLATES.filter(tpl => {
        if (textLibCat !== 'Tous' && tpl.cat !== textLibCat) return false;
        if (!q) return true;
        return tpl.cat.toLowerCase().includes(q) || tpl.parts.some(p => p.text.toLowerCase().includes(q));
      });
      const brandKit: BrandKit = { primary: workspaceData?.primary_color, secondary: workspaceData?.secondary_color, accent: workspaceData?.accent_color, font: workspaceData?.font_family };
      const hasCharter = !!(brandKit.primary || brandKit.accent);
      const useCharter = ttCharter && hasCharter;
      const show = (tpl: TextTemplate) => useCharter ? adaptTemplateToCharter(tpl, brandKit) : tpl;
      return (
        <div
          onClick={() => setTextLibOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'color-mix(in srgb, var(--ink) 55%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4vh 3vw', backdropFilter: 'blur(3px)' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: 'min(1180px, 96vw)', height: 'min(880px, 92vh)', background: 'var(--paper)', borderRadius: 'var(--r-xl)', boxShadow: '0 24px 80px rgba(0,0,0,0.32)', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--line)' }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '18px 22px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 style={{ margin: 0, fontSize: 20, fontFamily: 'var(--display)', fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.01em' }}>Bibliothèque de textes</h2>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--ink-3)' }}>{filtered.length} modèle{filtered.length > 1 ? 's' : ''} · cliquez pour ajouter au plan de travail</p>
              </div>
              <div style={{ position: 'relative', width: 260 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input value={textLibQuery} onChange={e => setTextLibQuery(e.target.value)} placeholder="Rechercher…" className="input"
                  style={{ width: '100%', paddingLeft: 34, height: 38 }} />
              </div>
              {hasCharter && (
                <button onClick={() => setTtCharter(v => !v)} title="Adapter les templates à la charte du client"
                  style={{ flexShrink: 0, height: 38, padding: '0 14px', borderRadius: 'var(--r-btn)', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 7, border: '1px solid ' + (useCharter ? 'var(--mint-2)' : 'var(--line)'), background: useCharter ? 'var(--leaf)' : 'var(--white)', color: useCharter ? 'var(--forest)' : 'var(--ink-2)' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: brandKit.accent || brandKit.primary || '#BDF2A0', display: 'inline-block' }} />
                  À ma charte
                </button>
              )}
              <button onClick={() => setTextLibOpen(false)} className="btn-icon" title="Fermer"
                style={{ flexShrink: 0, width: 38, height: 38 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {/* Category chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '12px 22px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
              {(['Tous', ...TT_CATS] as string[]).map(cat => {
                const active = textLibCat === cat;
                return (
                  <button key={cat} onClick={() => setTextLibCat(cat)}
                    style={{ padding: '6px 14px', borderRadius: 'var(--r-btn)', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--sans)', transition: 'all .12s',
                      border: active ? '1px solid var(--mint-2)' : '1px solid var(--line)',
                      background: active ? 'var(--leaf)' : 'var(--white)',
                      color: active ? 'var(--forest)' : 'var(--ink-2)' }}>
                    {cat}
                  </button>
                );
              })}
            </div>

            {/* Grid */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 22 }}>
              {filtered.length === 0 ? (
                <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: 'var(--ink-3)', fontSize: 14 }}>Aucun modèle ne correspond.</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                  {filtered.map(tpl => {
                    const shown = show(tpl);
                    return (
                    <button key={tpl.id} onClick={() => applyTextTemplate(shown)} title={tpl.cat}
                      style={{ position: 'relative', height: 168, padding: '16px 12px', borderRadius: 14, border: '1px solid var(--line)', cursor: 'pointer', background: tpl.dark ? '#1B1D18' : 'var(--white)', display: 'grid', placeItems: 'center', transition: 'all .14s', overflow: 'hidden' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--leaf)'; e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 10px 26px rgba(0,0,0,0.10)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}>
                      <TextTemplateThumb tpl={shown} w={230} />
                      <span style={{ position: 'absolute', bottom: 8, left: 8, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--mono)', fontWeight: 800, color: tpl.dark ? 'rgba(255,255,255,0.5)' : 'var(--ink-3)' }}>{tpl.cat}</span>
                    </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    })()}

    {/* ── BIBLIOTHÈQUE DE STICKERS — modale plein écran, toutes les illustrations ── */}
    {stickerLibOpen && (() => {
      const q = stickerLibQuery.trim().toLowerCase();
      const filtered = STICKERS.filter(s => {
        if (stickerCat !== 'Tous' && s.cat !== stickerCat) return false;
        if (!q) return true;
        return s.name.toLowerCase().includes(q) || s.cat.toLowerCase().includes(q);
      });
      return (
        <div
          onClick={() => setStickerLibOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'color-mix(in srgb, var(--ink) 55%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4vh 3vw', backdropFilter: 'blur(3px)' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: 'min(1180px, 96vw)', height: 'min(880px, 92vh)', background: 'var(--paper)', borderRadius: 'var(--r-xl)', boxShadow: '0 24px 80px rgba(0,0,0,0.32)', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--line)' }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '18px 22px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 style={{ margin: 0, fontSize: 20, fontFamily: 'var(--display)', fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.01em' }}>Bibliothèque d&apos;illustrations</h2>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--ink-3)' }}>{filtered.length} sticker{filtered.length > 1 ? 's' : ''} · la palette recolore les stickers recolorables</p>
              </div>
              <div style={{ position: 'relative', width: 240 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input value={stickerLibQuery} onChange={e => setStickerLibQuery(e.target.value)} placeholder="Rechercher…" className="input"
                  style={{ width: '100%', paddingLeft: 34, height: 38 }} />
              </div>
              <button onClick={() => setStickerLibOpen(false)} className="btn-icon" title="Fermer"
                style={{ flexShrink: 0, width: 38, height: 38 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {/* Palette recolorable + filtres */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', padding: '12px 22px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10, color: 'var(--ink-3)', fontFamily: 'var(--mono)', fontWeight: 700 }}>COULEUR</span>
                {[workspaceData?.primary_color || '#2FD79B', '#0C2A1D', '#BDF2A0', '#FF5A3C', '#FFD400', '#0038FF', '#9B5DE5', '#F15BB5', '#14160F', '#FFFFFF'].map(c => (
                  <button key={c} onClick={() => setStickerColor(c)} title={c}
                    style={{ width: 20, height: 20, borderRadius: '50%', background: c, cursor: 'pointer', border: stickerColor === c ? '2px solid var(--leaf)' : '1.5px solid var(--line)', padding: 0, boxShadow: c === '#FFFFFF' ? 'inset 0 0 0 1px var(--line)' : 'none' }} />
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(['Tous', ...STICKER_CATS] as string[]).map(cat => {
                  const active = stickerCat === cat;
                  return (
                    <button key={cat} onClick={() => setStickerCat(cat)}
                      style={{ padding: '6px 13px', borderRadius: 'var(--r-btn)', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'var(--sans)', transition: 'all .12s',
                        border: active ? '1px solid var(--mint-2)' : '1px solid var(--line)', background: active ? 'var(--leaf)' : 'var(--white)', color: active ? 'var(--forest)' : 'var(--ink-2)' }}>
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Grille — groupée par collection (sous-catégorie) façon Canva */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 22 }}>
              {filtered.length === 0 && stickerLibPhotos.length === 0 && !stickerLibPhotoLoading ? (
                <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: 'var(--ink-3)', fontSize: 14 }}>Aucun résultat.</div>
              ) : (<>
              {filtered.length > 0 && (() => {
                const cell = (s: Sticker) => (
                  <button key={s.id} onClick={() => { addSticker(s); setStickerLibOpen(false); }} title={s.name}
                    style={{ aspectRatio: '1', borderRadius: 14, border: '1px solid var(--line)', background: s.recolor && stickerColor === '#FFFFFF' ? '#3a3f36' : 'var(--white)', cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 16, transition: 'all .14s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--leaf)'; e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 10px 26px rgba(0,0,0,0.10)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={stickerDataUri(s, stickerColor)} alt={s.name} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                  </button>
                );
                // Regroupe par collection (sub). Ordre des collections = ordre d'apparition.
                const groups: { key: string; items: Sticker[] }[] = [];
                const idx: Record<string, number> = {};
                for (const s of filtered) {
                  const key = s.sub || s.cat;
                  if (idx[key] === undefined) { idx[key] = groups.length; groups.push({ key, items: [] }); }
                  groups[idx[key]].items.push(s);
                }
                // Une seule collection → pas d'en-tête (grille simple).
                if (groups.length <= 1) {
                  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12 }}>{filtered.map(cell)}</div>;
                }
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
                    {groups.map(g => (
                      <div key={g.key}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, fontFamily: 'var(--sans)', color: 'var(--ink)' }}>{g.key}</h3>
                          <span style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--mono)', fontWeight: 700 }}>{g.items.length}</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12 }}>{g.items.map(cell)}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}
              {/* Photos réelles (Pexels) — illustrations + photos pour une même recherche */}
              {(stickerLibPhotoLoading || stickerLibPhotos.length > 0) && (
                <div style={{ marginTop: filtered.length > 0 ? 30 : 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, fontFamily: 'var(--sans)', color: 'var(--ink)' }}>Photos</h3>
                    <span style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--mono)', fontWeight: 700 }}>{stickerLibPhotoLoading ? '…' : stickerLibPhotos.length}</span>
                  </div>
                  {stickerLibPhotos.length === 0 ? (
                    <div style={{ color: 'var(--ink-3)', fontSize: 13, padding: '10px 0' }}>Recherche de photos…</div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
                      {stickerLibPhotos.map(p => (
                        <button key={p.id} onClick={() => { addImageEl(`/api/proxy-image?url=${encodeURIComponent(p.full)}`); setStickerLibOpen(false); }} title={p.alt}
                          style={{ aspectRatio: '1', borderRadius: 14, border: '1px solid var(--line)', background: 'var(--sunk)', cursor: 'pointer', overflow: 'hidden', padding: 0, transition: 'all .14s' }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--leaf)'; e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 10px 26px rgba(0,0,0,0.10)'; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.thumb} alt={p.alt} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              </>)}
            </div>
          </div>
        </div>
      );
    })()}
    </>
  );
}

export default function EditorPage({ params }: { params: { id: string; postId: string } }) {
  return <VisualEditor workspaceId={params.id} postId={params.postId} mode="post" />;
}
