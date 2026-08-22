"use client";

// Éditeur de style de sous-titre — jeu de paramètres complet (façon CapCut).
// PARTAGÉ entre l'assistant « nouveau client » (charte, thème clair) et l'éditeur
// de montage (thème sombre .a-root) : les deux endroits proposent donc exactement
// les mêmes réglages. Le rendu est piloté par subtitleBoxCss/effectiveSubStyle,
// et répliqué à l'identique par l'export canvas (export.ts drawCaptions).
import React, { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Row, Ico, Num, Fold, Swatches, AlignIcon, chargerCatalogue, type GFont } from "@/components/EditorControls";
import { chargerPoliceGoogle } from "@/app/workspace/[id]/montage/[postId]/fonts";
import {
  effectiveSubStyle, applySubCase, subtitleBoxCss, subBgLayerCss, SUB_BASE_FONT,
  fitChunks, makeTextMeasurer,
  type SubCustom, type CaseMode, type SubAlign, type SubAnim,
} from "@/app/workspace/[id]/montage/[postId]/constants";

// Taille de police du sous-titre à l'échelle 1, telle que l'export la dessine
// (cf. export.ts). C'est elle qui permet d'afficher des pixels plutôt qu'un
// pourcentage abstrait.
const SUB_BASE_PX = 34;

// Polices déjà présentes dans la page : rien à aller chercher au catalogue.
const POLICES_MAISON = ["Archivo", "Instrument Serif", "Courier New"];

// ─── éditeur ─────────────────────────────────────────────────────────────────

/**
 * Réglages d'un sous-titre.
 *
 * MÊME PANNEAU QUE LE TEXTE, volontairement : mêmes lignes « libellé +
 * contrôle », même nuancier (la charte du client en tête, puis la pioche
 * maison), mêmes champs numériques à côté des curseurs, mêmes sections d'effets
 * qu'on allume à la case et qu'on replie. Les deux panneaux se suivent dans la
 * même colonne du monteur : tant qu'ils avaient chacun leur grammaire — ici des
 * onglets et le sélecteur de couleur du système, là des lignes et le nuancier
 * de la marque — on avait l'impression de changer de logiciel en passant de
 * l'un à l'autre. Les commandes viennent maintenant du même endroit
 * (components/EditorControls), donc elles ne peuvent plus diverger.
 *
 * PARTAGÉ avec l'assistant « nouveau client » et la page Modèles : les trois
 * endroits proposent exactement les mêmes réglages. Les libellés sont lus
 * directement dans le dictionnaire plutôt que recopiés par chaque appelant.
 */
export default function SubtitleStyleEditor({
  styleId, custom, onChange, brandFont, brandColors = [],
}: {
  styleId: string;
  custom: SubCustom;
  onChange: (patch: SubCustom) => void;
  brandFont?: string | null;
  /** Couleurs de la charte du client, proposées en tête du nuancier. */
  brandColors?: string[];
}) {
  const t = useTranslations("subtitleEditor");
  const e = effectiveSubStyle(styleId, custom);
  const patch = (p: SubCustom) => onChange({ ...custom, ...p });

  const [fonts, setFonts] = useState<GFont[]>([]);
  useEffect(() => { chargerCatalogue().then(setFonts); }, []);

  const police = e.font ?? "";
  // La police retenue doit être déclarée au navigateur, sinon l'aperçu la
  // mesure sur une autre fonte et le texte ne revient pas à la ligne au même
  // endroit que dans la vidéo.
  useEffect(() => {
    if (police && police !== brandFont && !POLICES_MAISON.includes(police)) chargerPoliceGoogle(police);
  }, [police, brandFont]);

  // Une police déjà enregistrée peut ne figurer dans aucune liste (import de la
  // marque, réglage ancien) : sans cette option, le menu s'afficherait vide
  // alors qu'une police est bien appliquée.
  const connues = new Set([...(brandFont ? [brandFont] : []), ...POLICES_MAISON, ...fonts.map((f) => f.family)]);
  const inconnue = police && !connues.has(police) ? police : null;

  const seg = <T extends string | number>(value: T, options: { v: T; label: React.ReactNode }[], on: (v: T) => void) => (
    <div className="mz-seg">
      {options.map((o) => (
        <button type="button" key={String(o.v)} className={value === o.v ? "on" : ""} onClick={() => on(o.v)}>{o.label}</button>
      ))}
    </div>
  );

  return (
    <>
      <div className="a-section">
        <span className="mz-sec-label">{t("basic")}</span>

        <Row label={t("font")}>
          <select className="mz-sel" value={police} onChange={(ev) => patch({ font: ev.target.value || undefined })}
            style={{ fontFamily: police ? `'${police}', var(--sans)` : undefined }}>
            <option value="">{t("system")}</option>
            {brandFont && <optgroup label={t("brandFonts")}><option value={brandFont}>{brandFont}</option></optgroup>}
            {inconnue && <option value={inconnue}>{inconnue}</option>}
            <optgroup label={t("builtInFonts")}>
              {POLICES_MAISON.map((f) => <option key={f} value={f}>{f}</option>)}
            </optgroup>
            {fonts.length > 0 && (
              <optgroup label={t("fontCatalogue")}>
                {fonts.filter((f) => f.family !== brandFont).map((f) => <option key={f.family} value={f.family}>{f.family}</option>)}
              </optgroup>
            )}
          </select>
        </Row>

        {/* La taille se règle en PIXELS du rendu final : « 120 % » ne disait rien
            de ce qu'on obtient. 34 px = échelle 1 à l'export. */}
        <Row label={t("size")}>
          <input className="mz-range" type="range" min={0.5} max={2.4} step={0.02} value={e.scale}
            onChange={(ev) => patch({ scale: parseFloat(ev.target.value) })} style={{ flex: 1 }} />
          <Num value={Math.round(e.scale * SUB_BASE_PX)} min={Math.round(0.5 * SUB_BASE_PX)} max={Math.round(2.4 * SUB_BASE_PX)} step={1} suffix="px"
            onChange={(px) => patch({ scale: +(px / SUB_BASE_PX).toFixed(3) })} />
        </Row>

        <Row label={t("style")}>
          <Ico on={e.weight >= 800} title={t("bold")} onClick={() => patch({ weight: e.weight >= 800 ? 600 : 800 })}>
            <span style={{ fontWeight: 900, fontSize: 13 }}>B</span>
          </Ico>
          <Ico on={e.italic} title={t("italic")} onClick={() => patch({ italic: !e.italic })}>
            <span style={{ fontStyle: "italic", fontWeight: 700, fontSize: 13, fontFamily: "Georgia, serif" }}>I</span>
          </Ico>
          <Ico on={e.underline} title={t("underline")} onClick={() => patch({ underline: !e.underline })}>
            <span style={{ textDecoration: "underline", fontWeight: 700, fontSize: 13 }}>U</span>
          </Ico>
          <span style={{ width: 6 }} />
          {(["left", "center", "right"] as const).map((k) => (
            <Ico key={k} on={e.align === k} title={t(k === "left" ? "alignLeft" : k === "right" ? "alignRight" : "alignCenter")}
              onClick={() => patch({ align: k as SubAlign })}>
              <AlignIcon k={k} />
            </Ico>
          ))}
        </Row>

        <Row label={t("case")}>
          {seg<CaseMode>(e.caseMode, [
            { v: "none", label: "Aa" }, { v: "upper", label: "AA" },
            { v: "lower", label: "aa" }, { v: "title", label: "Aa." },
          ], (v) => patch({ caseMode: v, uppercase: v === "upper" }))}
        </Row>

        <Row label={t("spacingPair")}>
          <Num value={e.letterSpacing} min={-0.05} max={0.5} step={0.01} suffix="em" onChange={(v) => patch({ letterSpacing: v })} />
          <Num value={e.lineHeight} min={0.9} max={2} step={0.05} suffix="↕" onChange={(v) => patch({ lineHeight: v })} />
        </Row>

        <Row label={t("text")}>
          <Swatches brandColors={brandColors} value={e.fg} onPick={(c) => patch({ fg: c })} />
        </Row>
        <Row label={t("highlight")}>
          <Swatches brandColors={brandColors} value={e.hi} onPick={(c) => patch({ hi: c })} />
        </Row>

        <Row label={t("opacity")}>
          <input className="mz-range" type="range" min={0.05} max={1} step={0.02} value={e.opacity}
            onChange={(ev) => patch({ opacity: parseFloat(ev.target.value) })} style={{ flex: 1 }} />
          <Num value={Math.round(e.opacity * 100)} min={5} max={100} step={5} suffix="%" onChange={(v) => patch({ opacity: v / 100 })} />
        </Row>
      </div>

      {/* Largeur du bloc et nombre de lignes : les deux réglages qui décident
          si un sous-titre tient sur une ligne ou se replie. L'export applique
          exactement les mêmes (cf. wrapWords). */}
      <div className="a-section">
        <span className="mz-sec-label">{t("layout")}</span>

        <Row label={t("boxWidth")}>
          <input className="mz-range" type="range" min={40} max={100} step={1} value={e.maxWidth}
            onChange={(ev) => patch({ maxWidth: parseFloat(ev.target.value) })} style={{ flex: 1 }} />
          <Num value={e.maxWidth} min={40} max={100} step={1} suffix="%" onChange={(v) => patch({ maxWidth: v })} />
        </Row>

        <Row label={t("lines")}>
          {seg<number>(e.maxLines, [
            { v: 1, label: t("oneLine") }, { v: 2, label: t("twoLines") }, { v: 3, label: t("threeLines") },
          ], (v) => patch({ maxLines: v }))}
        </Row>

        {/* « Mot par mot » (révélation façon CapCut) ou « Simple », où le
            sous-titre s'affiche d'un bloc. Le style complet s'applique dans les
            deux cas. */}
        <Row label={t("anim")}>
          {seg<SubAnim>(e.anim, [
            { v: "words", label: t("animWords") }, { v: "none", label: t("animNone") },
          ], (v) => patch({ anim: v }))}
        </Row>

        <Row label={t("rotation")}>
          <input className="mz-range" type="range" min={-45} max={45} step={1} value={e.rotation}
            onChange={(ev) => patch({ rotation: parseFloat(ev.target.value) })} style={{ flex: 1 }} />
          <Num value={e.rotation} min={-45} max={45} step={1} suffix="°" onChange={(v) => patch({ rotation: v })} />
        </Row>
      </div>

      <div className="a-section">
        <span className="mz-sec-label">{t("effects")}</span>

        <Fold name={t("stroke")} on={!!e.stroke && e.strokeW > 0}
          onToggle={(v) => patch(v ? { stroke: e.stroke || "#000000", strokeW: e.strokeW || 2 } : { stroke: "" })}>
          <Row label={t("thickness")}>
            <input className="mz-range" type="range" min={0.5} max={8} step={0.25} value={e.strokeW || 2}
              onChange={(ev) => patch({ strokeW: parseFloat(ev.target.value) })} style={{ flex: 1 }} />
            <Num value={e.strokeW} min={0} max={8} step={0.25} onChange={(v) => patch({ strokeW: v })} />
          </Row>
          <Row label={t("color")}>
            <Swatches brandColors={brandColors} value={e.stroke || "#000000"} onPick={(c) => patch({ stroke: c })} />
          </Row>
        </Fold>

        <Fold name={t("background")} on={e.bg !== "transparent"}
          onToggle={(v) => patch(v ? { bg: custom.bg && custom.bg !== "transparent" ? custom.bg : "#000000", bgOpacity: e.bgOpacity } : { bg: "transparent" })}>
          <Row label={t("color")}>
            <Swatches brandColors={brandColors} value={e.bg} onPick={(c) => patch({ bg: c })} />
          </Row>
          <Row label={t("opacity")}>
            <input className="mz-range" type="range" min={0} max={1} step={0.02} value={e.bgOpacity}
              onChange={(ev) => patch({ bgOpacity: parseFloat(ev.target.value) })} style={{ flex: 1 }} />
            <Num value={Math.round(e.bgOpacity * 100)} min={0} max={100} step={5} suffix="%" onChange={(v) => patch({ bgOpacity: v / 100 })} />
          </Row>
          <Row label={t("padding")}>
            <input className="mz-range" type="range" min={0} max={60} step={1} value={e.padX}
              onChange={(ev) => { const v = parseFloat(ev.target.value); patch({ padX: v, padY: Math.round(v * 0.5) }); }} style={{ flex: 1 }} />
            <Num value={e.padX} min={0} max={60} step={1} onChange={(v) => patch({ padX: v, padY: Math.round(v * 0.5) })} />
          </Row>
          {/* UN SEUL réglage d'arrondi, du carré à la pilule — comme pour le
              texte. La pilule n'est pas un mode : c'est le curseur poussé à
              fond, et les deux rendus bornent d'eux-mêmes à la moitié de la
              hauteur. */}
          <Row label={t("radius")}>
            <input className="mz-range" type="range" min={0} max={60} step={1} value={e.pill ? 60 : e.radius}
              onChange={(ev) => patch({ pill: false, radius: parseFloat(ev.target.value) })} style={{ flex: 1 }} />
            <Num value={e.pill ? 60 : e.radius} min={0} max={60} step={1} onChange={(v) => patch({ pill: false, radius: v })} />
          </Row>
          {/* Le fond se règle indépendamment du texte : on l'élargit, on le
              rehausse, on le décale sans que la typo bouge. */}
          <Row label={t("bgSize")}>
            <Num value={e.bgW} min={0} max={60} step={1} suffix="↔" onChange={(v) => patch({ bgW: v })} />
            <Num value={e.bgH} min={0} max={60} step={1} suffix="↕" onChange={(v) => patch({ bgH: v })} />
          </Row>
          <Row label={t("offset")}>
            <Num value={e.bgX} min={-40} max={40} step={1} suffix="x" onChange={(v) => patch({ bgX: v })} />
            <Num value={e.bgY} min={-40} max={40} step={1} suffix="y" onChange={(v) => patch({ bgY: v })} />
          </Row>
        </Fold>

        <Fold name={t("glow")} on={!!e.glowColor}
          onToggle={(v) => patch(v ? { glowColor: e.glowColor || "#FFFFFF", glowBlur: e.glowBlur || 12 } : { glowColor: "", glowBlur: 0 })}>
          <Row label={t("color")}>
            <Swatches brandColors={brandColors} value={e.glowColor || "#FFFFFF"} onPick={(c) => patch({ glowColor: c, glowBlur: e.glowBlur || 12 })} />
          </Row>
          <Row label={t("intensity")}>
            <input className="mz-range" type="range" min={0} max={40} step={1} value={e.glowBlur}
              onChange={(ev) => patch({ glowBlur: parseFloat(ev.target.value) })} style={{ flex: 1 }} />
            <Num value={e.glowBlur} min={0} max={40} step={1} onChange={(v) => patch({ glowBlur: v })} />
          </Row>
          {/* Intervalle : combien de passes de lueur on empile — serrée ou diffuse. */}
          <Row label={t("spread")}>
            <input className="mz-range" type="range" min={1} max={3} step={1} value={e.glowSpread}
              onChange={(ev) => patch({ glowSpread: parseFloat(ev.target.value) })} style={{ flex: 1 }} />
            <Num value={e.glowSpread} min={1} max={3} step={1} onChange={(v) => patch({ glowSpread: v })} />
          </Row>
          <Row label={t("offset")}>
            <Num value={e.glowX} min={-20} max={20} step={1} suffix="x" onChange={(v) => patch({ glowX: v })} />
            <Num value={e.glowY} min={-20} max={20} step={1} suffix="y" onChange={(v) => patch({ glowY: v })} />
          </Row>
        </Fold>

        <Fold name={t("shadow")} on={!!e.shadowColor}
          onToggle={(v) => patch(v ? { shadowColor: e.shadowColor || "#000000", shadowBlur: e.shadowBlur || 8 } : { shadowColor: "", shadowBlur: 0, shadowX: 0, shadowY: 0 })}>
          <Row label={t("color")}>
            <Swatches brandColors={brandColors} value={e.shadowColor || "#000000"} onPick={(c) => patch({ shadowColor: c, shadowBlur: e.shadowBlur || 8 })} />
          </Row>
          <Row label={t("blur")}>
            <input className="mz-range" type="range" min={0} max={40} step={1} value={e.shadowBlur}
              onChange={(ev) => patch({ shadowBlur: parseFloat(ev.target.value) })} style={{ flex: 1 }} />
            <Num value={e.shadowBlur} min={0} max={40} step={1} onChange={(v) => patch({ shadowBlur: v })} />
          </Row>
          <Row label={t("offset")}>
            <Num value={e.shadowX} min={-20} max={20} step={1} suffix="x" onChange={(v) => patch({ shadowX: v })} />
            <Num value={e.shadowY} min={-20} max={20} step={1} suffix="y" onChange={(v) => patch({ shadowY: v })} />
          </Row>
        </Fold>

        {/* Le texte se cintre vers le haut ou vers le bas. L'aperçu et l'export
            partagent la même formule (curveLayout) : sans ça, la courbe vue à
            l'écran ne serait pas celle de la vidéo. */}
        <Fold name={t("curve")} on={e.curve !== 0} onToggle={(v) => patch({ curve: v ? 30 : 0 })}>
          <Row label={t("curve")}>
            <input className="mz-range" type="range" min={-100} max={100} step={1} value={e.curve}
              onChange={(ev) => patch({ curve: parseFloat(ev.target.value) })} style={{ flex: 1 }} />
            <Num value={e.curve} min={-100} max={100} step={1} onChange={(v) => patch({ curve: v })} />
          </Row>
        </Fold>
      </div>
    </>
  );
}

// Aperçu d'un sous-titre rendu avec le style résolu (même source que le montage).
// activeIdx pilote le mot en surbrillance : -1 = aucun (rendu statique), sinon on
// reproduit la révélation progressive de drawCaptions (export.ts).
export function SubtitlePreviewChip({ styleId, custom, fontSize = 22, words = ["Vos", "clips"], activeIdx, progress, honorScale = false }: {
  styleId: string; custom?: SubCustom; fontSize?: number; words?: string[];
  activeIdx?: number; progress?: number;
  /** Fait vraiment réagir l'aperçu au curseur TAILLE. À laisser fermé sur les
   *  vignettes de style (le sélecteur de préréglages) : elles comparent des
   *  styles côte à côte à une taille fixe, une pastille ne doit pas gonfler au-
   *  delà de son cadre juste parce que le style choisi a un `scale` élevé.
   *  À ouvrir pour l'aperçu « comme sur la vidéo » : LÀ, `scale` est le réglage
   *  qu'on est en train de juger, il doit se voir. */
  honorScale?: boolean;
}) {
  const e = effectiveSubStyle(styleId, custom);
  // `fontSize` est la taille voulue pour la pastille d'aperçu, `subtitleBoxCss`
  // multiplie ensuite par `e.scale` en interne (comme l'export). Diviser par
  // `e.scale` ici annule EXACTEMENT cette multiplication : `k` retombe toujours
  // sur `fontSize`, quel que soit le curseur TAILLE — le réglage change le
  // chiffre affiché à côté du curseur, jamais le rendu. `honorScale` laisse le
  // facteur agir pour de vrai, là où c'est justement lui qu'on édite.
  const unit = honorScale ? fontSize / SUB_BASE_FONT : fontSize / SUB_BASE_FONT / (e.scale || 1);
  const css = subtitleBoxCss(e, unit) as React.CSSProperties;
  const animating = typeof activeIdx === "number" && activeIdx >= 0;
  return (
    <span style={{ ...css, display: "inline-block", maxWidth: "100%", transform: e.rotation ? `rotate(${e.rotation}deg)` : undefined }}>
      {(() => { const bg = subBgLayerCss(e, unit); return bg ? <span aria-hidden style={bg as React.CSSProperties} /> : null; })()}
      {/* Le texte est POSITIONNÉ, sinon le calque de fond lui passe par-dessus :
          un élément positionné se peint après le contenu en ligne, quel que soit
          son z-index. Les styles à fond (pilule, bandeau) montraient donc une
          barre de couleur vide, ici comme dans l'aperçu de l'assistant client. */}
      <span style={{ position: "relative", zIndex: 1 }}>
      {words.map((w, i) => {
        // Mêmes paliers d'opacité que l'export canvas : mot à venir 0.28,
        // mot révélé 0.35 → 1 selon sa propre progression.
        let alpha = 1;
        let color = i === 1 ? e.hi : e.fg;
        if (animating) {
          const wordProg = Math.max(0, Math.min(1, (progress ?? 0) * words.length - i));
          alpha = i <= activeIdx! ? 0.35 + 0.65 * wordProg : 0.28;
          color = i === activeIdx ? e.hi : e.fg;
        }
        return (
          <React.Fragment key={i}>
            <span style={{ color, opacity: alpha }}>{applySubCase(w, e.caseMode)}</span>
            {i < words.length - 1 ? " " : ""}
          </React.Fragment>
        );
      })}
      </span>
    </span>
  );
}

// ─── Scène d'aperçu ──────────────────────────────────────────────────────────
// Cadre 9:16 sur une VRAIE image, pour juger la lisibilité du sous-titre comme
// sur une vidéo. Les fonds viennent de /api/pexels (repli Openverse sans clé) ;
// on peut aussi déposer une image de son propre rush. Repli sur un décor
// synthétique si le réseau ne répond pas. Le sous-titre se place à la souris et
// se rejoue mot à mot avec la même mécanique que l'export.

// Requêtes volontairement COURTES : la banque anonyme (Openverse) renvoie des 403
// sur les requêtes longues, et refuse les rafales. On charge donc une scène à la
// fois, à la demande, jamais les trois en parallèle au montage du composant.
// Requêtes volontairement COURTES et NEUTRES : la banque anonyme (Openverse)
// renvoie des 403 sur les requêtes longues et refuse les rafales, et son premier
// résultat n'est pas curé — d'où le bouton « autre image » pour retirer au sort.
// Les trois scènes couvrent ce qui décide de la lisibilité : clair, sombre, chargé.
// Le premier décor est un GRIS NEUTRE, sans requête réseau : c'est ce qu'on veut
// voir par défaut pour juger une typographie. Une photo de campagne tirée au sort
// ne parle de rien et détourne l'œil du sujet — le retour de Martin.
// Les scènes photo restent là pour éprouver la lisibilité, qui est leur vraie
// raison d'être : clair, sombre, chargé.
const TEST_SCENES = [
  { id: 'neutre', q: '',          label: 'Fond neutre' },
  { id: 'clair',  q: 'landscape', label: 'Fond clair' },
  { id: 'sombre', q: 'night',     label: 'Fond sombre' },
  { id: 'charge', q: 'city',      label: 'Fond chargé' },
];

/** Aplat gris clair, en data URL : aucun aller-retour réseau, aucun échec possible. */
const NEUTRAL_BG = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#DEDEDA"/></svg>'
);

const DEMO_PHRASE = "Voilà à quoi ressemblent vos sous-titres";

// Longueur de bloc par défaut si aucune n'est fournie — cohérent avec
// DEFAULT_WORDS_PER_CAPTION (constants.ts), sans dépendre de ce module.
const DEFAULT_PREVIEW_MAX_WORDS = 4;

export function SubtitlePreviewStage({
  styleId, custom, pos, onPosChange, fontSize = 14, phrase = DEMO_PHRASE, hint,
  maxWords = DEFAULT_PREVIEW_MAX_WORDS, editableTextLabel, onScaleChange,
}: {
  styleId: string;
  custom?: SubCustom;
  pos: { x: number; y: number };
  onPosChange: (p: { x: number; y: number }) => void;
  fontSize?: number;
  phrase?: string;
  hint?: string;
  // Glisser directement le coin du sous-titre pour changer sa taille (en plus
  // du curseur TAILLE du panneau). Absent → pas de poignée affichée.
  onScaleChange?: (scale: number) => void;
  // Mots max par bloc (façon montage réel) : le texte se réaffiche par blocs
  // de cette taille plutôt qu'en une seule phrase figée. Passer un grand
  // nombre (ex. 99, "Phrase") pour tout afficher d'un bloc.
  maxWords?: number;
  editableTextLabel?: string;
}) {
  const stageRef = React.useRef<HTMLDivElement>(null);
  const [scene, setScene] = React.useState(0);
  // Plusieurs candidats par scène : « autre image » se contente d'avancer l'index,
  // sans nouvelle requête réseau.
  // Dérivé de TEST_SCENES : le tableau était figé à trois entrées, et ajouter
  // une scène laissait `pool[3]` indéfini — donc un plantage à la sélection.
  const [pool, setPool] = React.useState<string[][]>(() => TEST_SCENES.map(() => []));
  const [pick, setPick] = React.useState<number[]>([0, 0, 0]);
  const [ownFrame, setOwnFrame] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  // Lecture animée
  const [playing, setPlaying] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const rafRef = React.useRef<number | null>(null);

  // Texte modifiable : on part de `phrase` mais l'utilisateur peut le remplacer
  // par son propre exemple, pour juger le rendu sur SON texte plutôt que sur
  // une démo figée.
  const [customPhrase, setCustomPhrase] = React.useState(phrase);
  const words = React.useMemo(() => customPhrase.split(/\s+/).filter(Boolean), [customPhrase]);
  const DURATION = 2600; // ms — cadence proche d'un bloc de sous-titre réel

  // Redécoupage en blocs de `maxWords` mots — EXACTEMENT comme segmentCaptions()
  // appliqué à un vrai montage : le sous-titre s'affiche bloc par bloc, pas en
  // une phrase entière figée, pour montrer fidèlement combien de mots
  // apparaissent à l'écran à la fois.
  const step = Math.max(1, Math.floor(maxWords));

  // Largeur réelle de la scène : la limite de lignes ne veut rien dire sans elle.
  const [stageW, setStageW] = React.useState(0);
  React.useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setStageW(el.clientWidth));
    ro.observe(el);
    setStageW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const chunks = React.useMemo(() => {
    // Sans largeur connue (premier rendu), on retombe sur le découpage au mot :
    // l'effet dure une frame, le temps que la scène soit mesurée.
    if (!stageW) {
      const out: string[][] = [];
      for (let i = 0; i < words.length; i += step) out.push(words.slice(i, i + step));
      return out.length ? out : [[]];
    }
    const st = effectiveSubStyle(styleId, custom);
    const px = fontSize * (st.scale ?? 1);
    const base = makeTextMeasurer(
      `${st.italic ? "italic " : ""}${st.weight} ${px}px ${st.font || SUB_BASE_FONT}`,
      (st.letterSpacing ?? 0) * px,
    );
    // On MESURE en casse appliquée — les capitales sont sensiblement plus larges —
    // mais on renvoie les mots d'origine, la casse restant appliquée au rendu.
    const measure = (t: string) => base(applySubCase(t, st.caseMode));
    // La largeur du bloc est un pourcentage du cadre ; on retire le rembourrage
    // horizontal de la pilule, sinon on mesure plus large que la place réelle.
    const boxPx = (stageW * (st.maxWidth ?? 88)) / 100 - (st.pill ? px * 0.9 : 0);
    return fitChunks(words, step, measure, boxPx, st.maxLines ?? 1);
  }, [words, step, stageW, styleId, custom, fontSize]);

  // Charge la scène demandée si on ne l'a pas déjà. Une seule requête à la fois.
  React.useEffect(() => {
    if (pool[scene].length > 0) return;
    // Le fond neutre n'a rien à télécharger.
    if (!TEST_SCENES[scene].q) { setPool(prev => prev.map((v, i) => (i === scene ? [NEUTRAL_BG] : v))); return; }
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/pexels?query=${encodeURIComponent(TEST_SCENES[scene].q)}&page=1`);
        if (!r.ok) return;
        const j = await r.json();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const list: string[] = (j?.photos ?? [])
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((p: any) => p?.src?.large || p?.src?.medium)
          .filter((s: unknown): s is string => typeof s === 'string')
          .slice(0, 8)
          .map((s: string) => `/api/proxy-image?url=${encodeURIComponent(s)}`);
        if (!cancelled && list.length) setPool(prev => prev.map((v, i) => (i === scene ? list : v)));
      } catch { /* on garde le décor de repli */ }
    })();
    return () => { cancelled = true; };
  }, [scene, pool]);

  React.useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  // requestAnimationFrame est gelé dans un onglet en arrière-plan : sans ça, revenir
  // sur l'onglet laisserait la lecture figée en plein milieu et le bouton bloqué
  // sur « Lecture… ». On termine proprement l'animation en partant.
  React.useEffect(() => {
    const onHide = () => {
      if (document.hidden && rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        setProgress(1);
        setPlaying(false);
      }
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, []);

  const play = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const t0 = performance.now();
    setPlaying(true);
    const tick = (now: number) => {
      const p = (now - t0) / DURATION;
      if (p >= 1) { setProgress(1); setPlaying(false); rafRef.current = null; return; }
      setProgress(p);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  function onPointerDown(e: React.PointerEvent) {
    const box = stageRef.current;
    if (!box) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    const move = (clientX: number, clientY: number) => {
      const r = box.getBoundingClientRect();
      onPosChange({
        x: Math.round(Math.max(6, Math.min(94, ((clientX - r.left) / r.width) * 100))),
        y: Math.round(Math.max(6, Math.min(94, ((clientY - r.top) / r.height) * 100))),
      });
    };
    move(e.clientX, e.clientY);
    const onMove = (ev: PointerEvent) => move(ev.clientX, ev.clientY);
    const onUp = () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  // Poignée de coin : redimensionne en direct sur l'aperçu, au lieu de forcer
  // un aller-retour vers le curseur TAILLE du panneau. Le facteur d'échelle
  // suit le ratio distance-au-point-d'ancrage courante / distance de départ.
  const eff = effectiveSubStyle(styleId, custom);
  const [chipSize, setChipSize] = React.useState({ w: 0, h: 0 });
  const chipWrapRef = React.useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r) setChipSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
  }, []);

  function onResizeStart(ev: React.PointerEvent) {
    ev.preventDefault();
    ev.stopPropagation();
    const box = stageRef.current;
    if (!box || !onScaleChange) return;
    (ev.currentTarget as HTMLElement).setPointerCapture?.(ev.pointerId);
    const r = box.getBoundingClientRect();
    const anchorX = r.left + (pos.x / 100) * r.width;
    const anchorY = r.top + (pos.y / 100) * r.height;
    const d0 = Math.max(1, Math.hypot(ev.clientX - anchorX, ev.clientY - anchorY));
    const scale0 = eff.scale;
    const move = (clientX: number, clientY: number) => {
      const d1 = Math.max(1, Math.hypot(clientX - anchorX, clientY - anchorY));
      onScaleChange(Math.max(0.5, Math.min(2.4, +(scale0 * (d1 / d0)).toFixed(3))));
    };
    const onMove = (e: PointerEvent) => move(e.clientX, e.clientY);
    const onUp = () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  const sceneList = pool[scene];
  const bg = ownFrame ?? (sceneList.length ? sceneList[pick[scene] % sceneList.length] : null);

  // Progression globale répartie sur les BLOCS (pas sur les mots de toute la
  // phrase) : chaque bloc s'affiche à son tour, exactement comme au montage.
  const animating = playing || progress > 0;
  const chunkFloat = animating ? Math.min(chunks.length - 1e-6, progress * chunks.length) : 0;
  const activeChunk = Math.min(chunks.length - 1, Math.floor(chunkFloat));
  const chunkWords = chunks[activeChunk] ?? [];
  const chunkProgress = animating ? chunkFloat - activeChunk : 0;
  const activeIdx = animating
    ? Math.min(chunkWords.length - 1, Math.floor(chunkProgress * chunkWords.length))
    : -1;

  return (
    <div>
      <div
        ref={stageRef}
        onPointerDown={onPointerDown}
        style={{
          position: "relative", aspectRatio: "9 / 16", borderRadius: 12, overflow: "hidden",
          cursor: "grab", touchAction: "none", userSelect: "none",
          background: "linear-gradient(160deg,#3b4a52 0%,#22303a 42%,#131c22 100%)",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,.08)",
        }}
      >
        {bg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bg} alt="" draggable={false}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        ) : (
          // Repli si la banque d'images ne répond pas : on garde un décor lisible.
          <>
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(60% 40% at 50% 22%, rgba(255,236,190,.28), transparent 70%)" }} />
            <div style={{ position: "absolute", left: "50%", top: "34%", transform: "translate(-50%,-50%)", width: "42%", aspectRatio: "1", borderRadius: "50%", background: "rgba(255,255,255,.10)" }} />
          </>
        )}
        {/* Voile de lisibilité : il n'a de sens que sur une PHOTO. Sur l'aplat
            neutre il produisait un dégradé du gris clair au gris foncé, alors que
            tout l'intérêt de ce décor est d'être uni. */}
        {bg !== NEUTRAL_BG && (
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "34%", background: "linear-gradient(to top, rgba(0,0,0,.45), transparent)" }} />
        )}

        <div ref={chipWrapRef} style={{ position: "absolute", left: pos.x + "%", top: pos.y + "%", transform: "translate(-50%,-50%)", maxWidth: "88%", textAlign: "center", pointerEvents: "none" }}>
          <SubtitlePreviewChip
            styleId={styleId} custom={custom} fontSize={fontSize}
            words={chunkWords} activeIdx={activeIdx} progress={chunkProgress}
            honorScale
          />
        </div>

        {onScaleChange && chipSize.w > 0 && (
          <div
            onPointerDown={onResizeStart}
            title="Glisser pour changer la taille"
            style={{
              position: "absolute",
              left: `calc(${pos.x}% + ${chipSize.w / 2}px)`,
              top: `calc(${pos.y}% + ${chipSize.h / 2}px)`,
              transform: "translate(-50%,-50%)",
              width: 20, height: 20, borderRadius: 99, cursor: "nwse-resize",
              background: "rgba(12,42,29,.88)", boxShadow: "0 0 0 2px #EEEDE3",
              zIndex: 4, touchAction: "none",
            }}
          />
        )}

        <div style={{ position: "absolute", right: 8, bottom: 8, zIndex: 3, display: "flex", gap: 6 }}>
          {!ownFrame && sceneList.length > 1 && (
            <button type="button"
              onClick={e => { e.stopPropagation(); setPick(prev => prev.map((v, i) => (i === scene ? v + 1 : v))); }}
              onPointerDown={e => e.stopPropagation()}
              title="Autre image de test"
              style={{
                display: "grid", placeItems: "center", width: 28, height: 28,
                borderRadius: 99, border: "none", cursor: "pointer",
                background: "rgba(12,42,29,.82)", color: "#EEEDE3",
              }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7M21 4v4h-4"/></svg>
            </button>
          )}
          <button type="button" onClick={e => { e.stopPropagation(); play(); }}
            onPointerDown={e => e.stopPropagation()}
            title="Rejouer l'animation"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "6px 11px", borderRadius: 99, border: "none", cursor: "pointer",
              background: "rgba(12,42,29,.82)", color: "#EEEDE3",
              fontSize: 11.5, fontWeight: 800, fontFamily: "var(--sans)",
            }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 4l14 8-14 8V4Z" /></svg>
            {playing ? "Lecture…" : "Animer"}
          </button>
        </div>
      </div>

      {/* Choix du fond de test : la lisibilité dépend entièrement de l'image */}
      <div style={{ display: "flex", gap: 5, marginTop: 8, flexWrap: "wrap" }}>
        {TEST_SCENES.map((s, i) => (
          <button type="button" key={s.id}
            onClick={() => { setOwnFrame(null); setScene(i); }}
            className={!ownFrame && scene === i ? "btn btn-primary btn-sm" : "btn btn-ghost btn-sm"}
            style={{ fontSize: 11, padding: "4px 9px" }}>
            {s.label}
          </button>
        ))}
        <button type="button" onClick={() => fileRef.current?.click()}
          className={ownFrame ? "btn btn-primary btn-sm" : "btn btn-ghost btn-sm"}
          style={{ fontSize: 11, padding: "4px 9px" }}>
          Mon image
        </button>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
          onChange={e => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) setOwnFrame(URL.createObjectURL(f));
          }} />
      </div>

      {/* Texte d'exemple modifiable : on juge le rendu sur SON propre texte,
          plutôt que sur une phrase de démo imposée. */}
      <input
        type="text"
        value={customPhrase}
        onChange={(e) => setCustomPhrase(e.target.value)}
        placeholder={editableTextLabel}
        className="input"
        style={{ marginTop: 8, height: 32, fontSize: 12.5 }}
      />

      {hint && <p style={{ fontSize: 11.5, color: "var(--ink-3)", margin: "8px 0 0", lineHeight: 1.4 }}>{hint}</p>}
    </div>
  );
}
