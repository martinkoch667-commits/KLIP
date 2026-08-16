// lib/carouselDesigns.ts — le système de design des carrousels.
//
// POURQUOI CE FICHIER EXISTE
// La première version réutilisait la bibliothèque de mises en page (layoutLibrary),
// conçue pour poser du TEXTE SUR UNE PHOTO : ancrages, voiles sombres, texte blanc.
// Sans photo, ces recettes donnent un aplat de couleur avec du texte centré dessus.
// Ce n'est pas du design, c'est du remplissage — et ça se voit.
//
// Une slide de carrousel n'a pas de photo à habiller : elle doit se tenir toute
// seule. Donc la composition doit être DESSINÉE, pas juste positionnée : formes,
// aplats, filets d'accent, chiffres géants, cartes, pastilles. C'est ce que fait
// ce module.
//
// LE PARTAGE DU TRAVAIL
// L'IA choisit un archétype et écrit les textes. Tout le reste — géométrie,
// couleurs, hiérarchie typographique, décor — vient d'ici. Elle ne place jamais
// une coordonnée : c'est la seule façon d'avoir un rendu qui tienne debout quel
// que soit le texte.
//
// Le module ne dépend d'aucun état d'éditeur : il rend des objets bruts que
// l'appelant transforme en calques. Il sert donc aussi à décrire les archétypes
// à l'IA, côté serveur, sans dupliquer quoi que ce soit.

// ─── Thème dérivé de la charte ──────────────────────────────────────────────

export interface CarouselTheme {
  ground: string;      // fond principal
  groundTo: string;    // seconde couleur du dégradé de fond
  ink: string;         // encre lisible sur `ground`
  inkSoft: string;     // encre secondaire (sous-titres) — même teinte, moins présente
  accent: string;      // couleur d'accent de la marque
  accentInk: string;   // encre lisible SUR l'accent
  surface: string;     // cartes / pastilles posées sur le fond
  surfaceInk: string;
  display: string;     // police des titres
  body: string;        // police des textes courants
}

const HEX = /^#([0-9a-fA-F]{6})$/;
const ok = (c?: string | null): c is string => !!c && HEX.test(c);

export function hexLuma(hex: string): number {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  // Pondération perceptuelle : l'œil est bien plus sensible au vert qu'au bleu,
  // et une moyenne brute fait passer un bleu saturé pour une couleur claire.
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Mélange vers le blanc (t > 0) ou vers le noir (t < 0). */
function shade(hex: string, t: number): string {
  const h = hex.replace('#', '');
  const to = t > 0 ? 255 : 0;
  const k = Math.abs(t);
  const mix = (v: number) => Math.round(v + (to - v) * k);
  const r = mix(parseInt(h.slice(0, 2), 16));
  const g = mix(parseInt(h.slice(2, 4), 16));
  const b = mix(parseInt(h.slice(4, 6), 16));
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

const inkOn = (bg: string) => (hexLuma(bg) > 0.55 ? '#14160F' : '#FFFFFF');

export interface BrandInput {
  primary_color?: string | null;
  secondary_color?: string | null;
  accent_color?: string | null;
  font_family?: string | null;
  font_secondary?: string | null;
}

export function themeFromBrand(b: BrandInput | null | undefined): CarouselTheme {
  // Un fond sombre est le choix par défaut : c'est ce qui tient le mieux sur un
  // fil Instagram, et ça pardonne les couleurs de charte les plus criardes.
  const ground = ok(b?.primary_color) ? b!.primary_color! : '#14160F';
  const accent = ok(b?.accent_color) ? b!.accent_color! : ok(b?.secondary_color) ? b!.secondary_color! : '#BDF2A0';
  const dark = hexLuma(ground) <= 0.55;
  const ink = inkOn(ground);
  return {
    ground,
    // Dégradé très léger : il donne de la profondeur sans se remarquer. Un
    // dégradé franc daterait le visuel immédiatement.
    groundTo: shade(ground, dark ? 0.1 : -0.08),
    ink,
    inkSoft: dark ? shade(ground, 0.62) : shade(ground, -0.45),
    accent,
    accentInk: inkOn(accent),
    surface: dark ? shade(ground, 0.09) : shade(ground, -0.06),
    surfaceInk: ink,
    display: b?.font_family || 'Archivo',
    body: b?.font_secondary || b?.font_family || 'Archivo',
  };
}

// ─── Archétypes ─────────────────────────────────────────────────────────────

/** Rôles de texte qu'un archétype sait accueillir. */
export type SlotRole = 'kicker' | 'titre' | 'corps' | 'cta';

export interface Archetype {
  id: string;
  /** Description destinée à l'IA : à quoi sert cette slide. */
  desc: string;
  /** Emplacements de texte, dans l'ordre. `max` = longueur conseillée en mots. */
  slots: { role: SlotRole; max: number; required?: boolean }[];
  /** Position dans le carrousel où cet archétype a du sens. */
  use: 'cover' | 'content' | 'closing';
}

export const CAROUSEL_ARCHETYPES: Archetype[] = [
  {
    id: 'cover-statement',
    use: 'cover',
    desc: "Couverture : filet d'accent, sur-titre court, titre énorme sur plusieurs lignes, invitation à balayer. Pour la promesse d'ouverture.",
    slots: [{ role: 'kicker', max: 4 }, { role: 'titre', max: 9, required: true }, { role: 'corps', max: 18 }],
  },
  {
    id: 'cover-question',
    use: 'cover',
    desc: "Couverture alternative : grand point d'interrogation en filigrane, question en gros. Pour ouvrir sur une question ou une idée reçue.",
    slots: [{ role: 'titre', max: 10, required: true }, { role: 'corps', max: 16 }],
  },
  {
    id: 'numbered',
    use: 'content',
    desc: "Point numéroté : chiffre géant en filigrane dans le fond, titre, paragraphe. L'archétype de base pour dérouler des points l'un après l'autre.",
    slots: [{ role: 'titre', max: 7, required: true }, { role: 'corps', max: 32 }],
  },
  {
    id: 'card',
    use: 'content',
    desc: "Carte posée sur le fond, avec un onglet d'accent en haut. Pour une idée qui mérite d'être isolée du reste.",
    slots: [{ role: 'kicker', max: 3 }, { role: 'titre', max: 7, required: true }, { role: 'corps', max: 30 }],
  },
  {
    id: 'statement',
    use: 'content',
    desc: "Punchline : une phrase seule, très grande, avec un guillemet d'accent. Pour un constat fort, une citation, un chiffre marquant.",
    slots: [{ role: 'titre', max: 14, required: true }, { role: 'corps', max: 8 }],
  },
  {
    id: 'split',
    use: 'content',
    desc: "Bandeau d'accent sur la moitié basse : titre sur le fond, explication dans le bandeau. Pour opposer deux choses ou marquer une rupture.",
    slots: [{ role: 'titre', max: 8, required: true }, { role: 'corps', max: 28 }],
  },
  {
    id: 'checklist',
    use: 'content',
    desc: "Liste à pastilles : titre puis 3 points courts, chacun avec une pastille d'accent. Le corps contient les points séparés par « | ».",
    slots: [{ role: 'titre', max: 7, required: true }, { role: 'corps', max: 30, required: true }],
  },
  {
    id: 'cta-solid',
    use: 'closing',
    desc: "Clôture : fond entièrement en accent, titre de conclusion et bouton d'appel à l'action. Toujours la dernière slide.",
    slots: [{ role: 'titre', max: 9, required: true }, { role: 'corps', max: 18 }, { role: 'cta', max: 5, required: true }],
  },
];

// ─── Construction des calques ───────────────────────────────────────────────

/** Calque sans identifiant — l'appelant en attribue un. */
export type ElSpec = Record<string, unknown>;

interface Ctx { W: number; H: number; t: CarouselTheme }

const rect = (c: Ctx, o: Partial<ElSpec> & { x: number; y: number; width: number; height: number; fill: string }): ElSpec => ({
  type: 'rect', rotation: 0, opacity: 100, stroke: '', strokeWidth: 0, cornerRadius: 0, ...o,
});

const circle = (o: { x: number; y: number; radius: number; fill: string; opacity?: number }): ElSpec => ({
  type: 'circle', rotation: 0, opacity: 100, stroke: '', strokeWidth: 0, ...o,
});

/** Bloc de texte. `size` est en % de la HAUTEUR du cadre — la référence stable
 *  quel que soit le format (4:5, 1:1, 9:16). */
function text(
  c: Ctx,
  o: {
    text: string; xPct: number; yPct: number; wPct: number; size: number;
    fill: string; font?: string; bold?: boolean; align?: string;
    upper?: boolean; lh?: number; ls?: number; opacity?: number; maxLines?: number;
  },
): ElSpec {
  const width = Math.round((o.wPct / 100) * c.W);
  const fontSize = Math.max(11, Math.round((o.size / 100) * c.H));
  return {
    type: 'text', text: o.text,
    x: Math.round((o.xPct / 100) * c.W),
    y: Math.round((o.yPct / 100) * c.H),
    width, rotation: 0, opacity: o.opacity ?? 100,
    fontSize,
    fontFamily: o.font ?? c.t.display,
    fontStyle: o.bold === false ? 'normal' : 'bold',
    textDecoration: '',
    fill: o.fill,
    align: o.align ?? 'left',
    hasBg: false, bgColor: '#000000', bgOpacity: 80, cornerRadius: 6,
    padding: 0, paddingH: 0, paddingV: 0,
    uppercase: !!o.upper,
    lineHeight: o.lh ?? 1.08,
    letterSpacing: o.ls ?? 0,
    // Garde-fou de débordement : un titre trop long rétrécit au lieu de sortir du
    // cadre. Sans ça, une accroche un peu bavarde ruine la composition.
    maxLines: o.maxLines ?? 4,
    minFontSize: Math.max(11, Math.round(fontSize * 0.55)),
    maxFontSize: fontSize,
  };
}

/**
 * Hauteur RÉSERVÉE par un bloc de texte, en % de la hauteur du cadre.
 *
 * On ne mesure pas et on n'estime pas : on réserve le PIRE CAS, `maxLines` lignes
 * pleines. C'est une borne supérieure vraie — l'éditeur rétrécit le texte jusqu'à
 * `minFontSize` pour tenir dans `maxLines`, donc un bloc n'occupe jamais plus.
 *
 * La version précédente estimait le nombre de lignes à partir d'une largeur
 * moyenne de caractère. Ça marchait sur une grotesque en bas de casse et ça
 * cassait sur une serif en capitales : le corps de texte passait sur la dernière
 * ligne du titre. Une composition juste-un-peu-trop-aérée se corrige à l'œil ;
 * deux textes superposés, non.
 *
 * En % de cadre, la formule se réduit à maxLines × taille × interligne.
 */
const reservePct = (size: number, lh: number, maxLines: number) => maxLines * size * lh;

/**
 * Empile des blocs de texte, chacun sous le précédent. C'était LE défaut de la
 * première version : chaque bloc était posé à une hauteur fixe, calculée en
 * supposant que le titre tiendrait sur deux lignes. Dès qu'il en prenait trois,
 * le corps de texte lui passait dessus.
 */
function stack(
  c: Ctx,
  startPct: number,
  blocks: (Parameters<typeof text>[1] & { gapAfter?: number } | null)[],
): ElSpec[] {
  const out: ElSpec[] = [];
  let y = startPct;
  for (const b of blocks) {
    if (!b) continue;
    out.push(text(c, { ...b, yPct: y }));
    y += reservePct(b.size, b.lh ?? 1.08, b.maxLines ?? 4) + (b.gapAfter ?? 2.5);
  }
  return out;
}

export interface SlideTexts {
  kicker?: string;
  titre?: string;
  corps?: string;
  cta?: string;
}

/**
 * Construit les calques d'une slide.
 * `index` / `total` servent au décor de progression (numéro, pastilles).
 */
export function buildCarouselSlide(
  archetypeId: string,
  texts: SlideTexts,
  theme: CarouselTheme,
  W: number,
  H: number,
  index: number,
  total: number,
): ElSpec[] {
  const t = theme;
  const c: Ctx = { W, H, t };
  const els: ElSpec[] = [];
  const arch = CAROUSEL_ARCHETYPES.find((a) => a.id === archetypeId) ?? CAROUSEL_ARCHETYPES[2];
  const onAccent = arch.id === 'cta-solid';

  // Fond : dégradé très doux, ou aplat d'accent pour la clôture.
  els.push(rect(c, {
    x: 0, y: 0, width: W, height: H,
    fill: onAccent ? t.accent : t.ground,
    ...(onAccent ? {} : { fillType: 'gradient', fillTo: t.groundTo, fillAngle: 135 }),
  }));

  const ink = onAccent ? t.accentInk : t.ink;
  const soft = onAccent ? t.accentInk : t.inkSoft;

  switch (arch.id) {
    case 'cover-statement': {
      // Filet d'accent : le petit signe qui dit « ceci est une couverture ».
      els.push(rect(c, { x: Math.round(0.08 * W), y: Math.round(0.16 * H), width: Math.round(0.14 * W), height: Math.max(4, Math.round(0.007 * H)), fill: t.accent, cornerRadius: 999 }));
      els.push(...stack(c, 20, [
        texts.kicker ? { text: texts.kicker, xPct: 8, yPct: 0, wPct: 80, size: 2.6, fill: t.accent, upper: true, ls: 0.14, maxLines: 1, gapAfter: 1.6 } : null,
        { text: texts.titre ?? '', xPct: 8, yPct: 0, wPct: 84, size: 10.5, fill: ink, upper: true, lh: 1.0, maxLines: 4, gapAfter: 3 },
        texts.corps ? { text: texts.corps, xPct: 8, yPct: 0, wPct: 72, size: 3.2, fill: soft, bold: false, font: t.body, lh: 1.35, maxLines: 3 } : null,
      ]));
      // Invitation à balayer, en bas à droite.
      els.push(rect(c, { x: Math.round(0.62 * W), y: Math.round(0.87 * H), width: Math.round(0.3 * W), height: Math.round(0.055 * H), fill: t.accent, cornerRadius: 999 }));
      els.push(text(c, { text: 'BALAYEZ →', xPct: 62, yPct: 88.5, wPct: 30, size: 2.4, fill: t.accentInk, align: 'center', upper: true, ls: 0.12, maxLines: 1 }));
      break;
    }
    case 'cover-question': {
      // Point d'interrogation géant en filigrane : le décor porte le sens.
      els.push(text(c, { text: '?', xPct: 52, yPct: 8, wPct: 60, size: 52, fill: t.accent, opacity: 16, lh: 1, maxLines: 1 }));
      els.push(...stack(c, 28, [
        { text: texts.titre ?? '', xPct: 8, yPct: 0, wPct: 82, size: 9.5, fill: ink, upper: true, lh: 1.03, maxLines: 4, gapAfter: 3 },
        texts.corps ? { text: texts.corps, xPct: 8, yPct: 0, wPct: 70, size: 3.2, fill: soft, bold: false, font: t.body, lh: 1.35, maxLines: 3 } : null,
      ]));
      break;
    }
    case 'numbered': {
      // Chiffre géant en filigrane — repère de lecture ET décor.
      const n = String(index).padStart(2, '0');
      els.push(text(c, { text: n, xPct: 55, yPct: 4, wPct: 55, size: 40, fill: t.accent, opacity: 14, align: 'right', lh: 1, maxLines: 1 }));
      els.push(rect(c, { x: Math.round(0.08 * W), y: Math.round(0.3 * H), width: Math.round(0.1 * W), height: Math.max(4, Math.round(0.006 * H)), fill: t.accent, cornerRadius: 999 }));
      els.push(...stack(c, 34, [
        { text: texts.titre ?? '', xPct: 8, yPct: 0, wPct: 80, size: 7.6, fill: ink, upper: true, lh: 1.05, maxLines: 3, gapAfter: 3.5 },
        texts.corps ? { text: texts.corps, xPct: 8, yPct: 0, wPct: 78, size: 3.4, fill: soft, bold: false, font: t.body, lh: 1.42, maxLines: 5 } : null,
      ]));
      break;
    }
    case 'card': {
      const cx = Math.round(0.07 * W), cy = Math.round(0.2 * H);
      const cw = Math.round(0.86 * W), ch = Math.round(0.6 * H);
      els.push(rect(c, { x: cx, y: cy, width: cw, height: ch, fill: t.surface, cornerRadius: Math.round(0.035 * W) }));
      // Onglet d'accent en haut de la carte.
      els.push(rect(c, { x: cx + Math.round(0.06 * W), y: cy - Math.round(0.012 * H), width: Math.round(0.22 * W), height: Math.round(0.024 * H), fill: t.accent, cornerRadius: 999 }));
      els.push(...stack(c, 27, [
        texts.kicker ? { text: texts.kicker, xPct: 13, yPct: 0, wPct: 60, size: 2.5, fill: t.accent, upper: true, ls: 0.14, maxLines: 1, gapAfter: 1.4 } : null,
        { text: texts.titre ?? '', xPct: 13, yPct: 0, wPct: 74, size: 7, fill: t.surfaceInk, upper: true, lh: 1.06, maxLines: 2, gapAfter: 2.5 },
        texts.corps ? { text: texts.corps, xPct: 13, yPct: 0, wPct: 72, size: 3.3, fill: soft, bold: false, font: t.body, lh: 1.42, maxLines: 4 } : null,
      ]));
      break;
    }
    case 'statement': {
      // Guillemet d'ouverture, très grand, en accent : signe de citation.
      els.push(text(c, { text: '“', xPct: 7, yPct: 12, wPct: 40, size: 30, fill: t.accent, lh: 1, maxLines: 1 }));
      const qLines = 5;
      els.push(text(c, { text: texts.titre ?? '', xPct: 8, yPct: 33, wPct: 82, size: 7.4, fill: ink, lh: 1.18, maxLines: qLines }));
      if (texts.corps) {
        // L'attribution suit la citation quelle que soit sa longueur.
        const after = (33 + reservePct(7.4, 1.18, qLines) + 3) / 100;
        els.push(rect(c, { x: Math.round(0.08 * W), y: Math.round(after * H), width: Math.round(0.08 * W), height: Math.max(3, Math.round(0.005 * H)), fill: t.accent, cornerRadius: 999 }));
        els.push(text(c, { text: texts.corps, xPct: 8, yPct: after * 100 + 2.2, wPct: 70, size: 2.9, fill: soft, bold: false, font: t.body, upper: true, ls: 0.1, maxLines: 2 }));
      }
      break;
    }
    case 'split': {
      const bandY = Math.round(0.52 * H);
      els.push(rect(c, { x: 0, y: bandY, width: W, height: H - bandY, fill: t.accent }));
      els.push(text(c, { text: texts.titre ?? '', xPct: 8, yPct: 20, wPct: 80, size: 8.4, fill: ink, upper: true, lh: 1.04, maxLines: 3 }));
      if (texts.corps) els.push(text(c, { text: texts.corps, xPct: 8, yPct: 60, wPct: 78, size: 3.4, fill: t.accentInk, bold: false, font: t.body, lh: 1.42, maxLines: 5 }));
      break;
    }
    case 'checklist': {
      const titre = texts.titre ?? '';
      els.push(text(c, { text: titre, xPct: 8, yPct: 18, wPct: 78, size: 7.2, fill: ink, upper: true, lh: 1.05, maxLines: 2 }));
      // Le corps arrive en points séparés par « | » — on les pose en liste à pastilles,
      // sous le titre quelle que soit sa hauteur réelle.
      const listTop = (18 + reservePct(7.2, 1.05, 2) + 4) / 100;
      const items = (texts.corps ?? '').split('|').map((s) => s.trim()).filter(Boolean).slice(0, 4);
      items.forEach((item, i) => {
        const y = listTop + i * 0.13;
        els.push(circle({ x: Math.round(0.11 * W), y: Math.round((y + 0.018) * H), radius: Math.round(0.016 * W), fill: t.accent }));
        els.push(text(c, { text: item, xPct: 17, yPct: y * 100, wPct: 74, size: 3.4, fill: soft, bold: false, font: t.body, lh: 1.3, maxLines: 2 }));
      });
      break;
    }
    case 'cta-solid': {
      els.push(...stack(c, 26, [
        { text: texts.titre ?? '', xPct: 8, yPct: 0, wPct: 82, size: 8.6, fill: t.accentInk, upper: true, lh: 1.04, maxLines: 3, gapAfter: 3 },
        texts.corps ? { text: texts.corps, xPct: 8, yPct: 0, wPct: 74, size: 3.3, fill: t.accentInk, bold: false, font: t.body, lh: 1.4, opacity: 78, maxLines: 2 } : null,
      ]));
      // Bouton : une pastille pleine dans l'encre du fond, l'inverse de l'accent.
      const by = Math.round(0.76 * H);
      els.push(rect(c, { x: Math.round(0.08 * W), y: by, width: Math.round(0.62 * W), height: Math.round(0.08 * H), fill: t.accentInk, cornerRadius: 999 }));
      els.push(text(c, { text: texts.cta ?? '', xPct: 8, yPct: (by / H) * 100 + 2.4, wPct: 62, size: 3.1, fill: t.accent, align: 'center', upper: true, ls: 0.1, maxLines: 1 }));
      break;
    }
  }

  // Pastilles de progression, sur toutes les slides sauf la clôture : elles
  // signalent qu'il y a une suite, ce qui est exactement le but d'un carrousel.
  if (!onAccent && total > 1) {
    const r = Math.max(2, Math.round(0.0055 * W));
    const gap = r * 4;
    const totalW = total * r * 2 + (total - 1) * (gap - r * 2);
    let x = Math.round((W - totalW) / 2) + r;
    for (let i = 1; i <= total; i++) {
      els.push(circle({
        x, y: Math.round(0.945 * H), radius: r,
        fill: i === index ? t.accent : t.ink,
        opacity: i === index ? 100 : 28,
      }));
      x += gap;
    }
  }

  return els;
}
