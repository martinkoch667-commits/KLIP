// lib/typeIdentity.ts — l'identité typographique d'une marque.
//
// POURQUOI CE FICHIER
// Le système de design savait dessiner cinquante compositions, mais il les
// habillait toutes pareil : la police de titre de la charte (ou Archivo à
// défaut), et pour les gestes que la charte ne fournit jamais — le condensé
// d'affiche, le serif de presse, le manuscrit — trois constantes en dur, les
// mêmes pour tout le monde : Anton, Playfair Display, Caveat. Trois polices
// vues sur la moitié des visuels générés d'internet. Une composition juste
// habillée d'une typo scolaire ressemble à un template, et c'est exactement le
// reproche : « on voit que c'est l'IA qui a généré ».
//
// Une identité typographique n'est pas une police, c'est un ENSEMBLE qui se
// répond : un titrage, un texte courant, et les trois gestes. Plus une manière
// de les poser — graisse, interlettrage, capitales — parce que Switzer en 300
// très espacé et Switzer en 900 serré ne sont pas la même marque.
//
// COMMENT ELLE EST CHOISIE
// Par secteur et par ton, puis départagée par une empreinte STABLE du nom de la
// marque. Deux conséquences voulues :
//  · le même client garde la même typo d'un post à l'autre — un feed tient par
//    sa typographie avant de tenir par ses couleurs ;
//  · deux restaurants ne reçoivent pas la même, alors que le secteur est le
//    même. Sans ce départage, « choisir par secteur » ne ferait que remplacer
//    un générique par huit génériques.
//
// La charte du client reste souveraine : si elle déclare une police de titre,
// c'est elle qui titre. L'identité fournit alors les gestes manquants — c'est
// déjà ce qui sépare deux marques qui titrent l'une et l'autre en Poppins.

import type { Vibe } from './designSystem';

export interface TypeIdentity {
  id: string;
  name: string;
  /** Personnalités de marque pour lesquelles l'ensemble est juste. */
  vibes: Vibe[];
  /** Secteurs d'affinité (pas d'exclusivité). */
  sectors: string[];
  /** Titrage, quand la charte n'impose rien. */
  display: string;
  /** Texte courant. */
  body: string;
  /** Geste d'affiche : colonne étroite, gros calibre. */
  condensed: string;
  /** Geste de presse : empattements, contraste. */
  serif: string;
  /** Geste manuscrit : la signature posée sur la photo, le mot corrigé. */
  script: string;
  /** Graisse des titres. C'est elle, plus que la famille, qui donne le ton. */
  titleWeight: 300 | 400 | 500 | 600 | 700 | 800 | 900;
  /** Graisse des petits textes (rails, tags, mentions). */
  microWeight: 400 | 500 | 600 | 700 | 800;
  /** Interlettrage AJOUTÉ aux titres, en fraction de la taille de police.
   *  Négatif = titres serrés (affiche, mode) ; positif = titres aérés (luxe). */
  titleTrack: number;
  /** Interlettrage ajouté aux capitales espacées (rails, kickers). */
  microTrack: number;
  /** Une phrase pour le journal de génération : ce que cette typo raconte. */
  note: string;
}

// ── Les ensembles ────────────────────────────────────────────────────────────
//
// Quatorze, pas cinquante : une identité typographique doit se reconnaître, et
// on en juge la qualité en planche contact (/banc-design), pas au catalogue.
// Toutes les familles citées existent au catalogue (`fontCatalog.ts`) : une
// police absente sortirait en repli système, sans erreur visible.

export const TYPE_IDENTITIES: TypeIdentity[] = [
  {
    id: 'suisse',
    name: 'Grotesque suisse',
    vibes: ['minimal', 'sobre', 'tech'],
    sectors: ['Tech', 'Retail', 'Autre'],
    display: 'Switzer', body: 'Switzer', condensed: 'Khand', serif: 'Gambetta', script: 'Telma',
    titleWeight: 700, microWeight: 600, titleTrack: -0.02, microTrack: 0.16,
    note: 'Un seul grotesque, deux graisses, beaucoup de blanc.',
  },
  {
    id: 'editorial-contraste',
    name: 'Serif de presse',
    vibes: ['editorial', 'luxe', 'sobre'],
    sectors: ['Mode', 'Beauté', 'Autre'],
    display: 'Zodiak', body: 'Satoshi', condensed: 'Big Shoulders Display', serif: 'Zodiak', script: 'Telma',
    titleWeight: 400, microWeight: 700, titleTrack: -0.015, microTrack: 0.2,
    note: 'Titre en serif à fort contraste, tout le reste en grotesque discret.',
  },
  {
    id: 'affiche',
    name: 'Affiche',
    vibes: ['audacieux', 'ludique'],
    sectors: ['Restaurant', 'Sport', 'Retail'],
    display: 'Clash Display', body: 'General Sans', condensed: 'Khand', serif: 'Boska', script: 'Britney',
    titleWeight: 600, microWeight: 600, titleTrack: -0.03, microTrack: 0.14,
    note: 'Titres serrés et pleins, comme une affiche collée en ville.',
  },
  {
    id: 'douceur',
    name: 'Serif douce',
    vibes: ['chaleureux', 'luxe'],
    sectors: ['Beauté', 'Café', 'Mode'],
    display: 'Melodrama', body: 'Synonym', condensed: 'Khand', serif: 'Gambetta', script: 'Rosaline',
    titleWeight: 400, microWeight: 500, titleTrack: 0, microTrack: 0.22,
    note: 'Un titrage doux, des capitales très espacées, rien qui crie.',
  },
  {
    id: 'brut',
    name: 'Gras brut',
    vibes: ['audacieux', 'retro'],
    sectors: ['Restaurant', 'Sport', 'Retail'],
    display: 'Tanker', body: 'Switzer', condensed: 'Kola', serif: 'Rowan', script: 'Comico',
    titleWeight: 400, microWeight: 700, titleTrack: -0.025, microTrack: 0.1,
    note: 'Le mot prend tout le cadre ; le reste se fait tout petit.',
  },
  {
    id: 'neo-geo',
    name: 'Néo-géométrique',
    vibes: ['tech', 'minimal'],
    sectors: ['Tech', 'Autre', 'Sport'],
    display: 'Nippo', body: 'Author', condensed: 'Teko', serif: 'Sentient', script: 'Telma',
    titleWeight: 500, microWeight: 500, titleTrack: -0.01, microTrack: 0.24,
    note: 'Formes géométriques, graisses moyennes, beaucoup d\'air entre les lettres.',
  },
  {
    id: 'arrondi',
    name: 'Arrondi chaleureux',
    vibes: ['chaleureux', 'ludique'],
    sectors: ['Café', 'Restaurant', 'Beauté'],
    display: 'Chillax', body: 'Quilon', condensed: 'Khand', serif: 'Erode', script: 'Kalam',
    titleWeight: 600, microWeight: 600, titleTrack: -0.01, microTrack: 0.12,
    note: 'Angles arrondis, graisses franches : accueillant sans être mou.',
  },
  {
    id: 'presse',
    name: 'Presse contemporaine',
    vibes: ['editorial', 'sobre'],
    sectors: ['Autre', 'Tech', 'Retail'],
    display: 'Instrument Serif', body: 'Geist', condensed: 'Darker Grotesque', serif: 'Instrument Serif', script: 'Telma',
    titleWeight: 400, microWeight: 500, titleTrack: -0.02, microTrack: 0.18,
    note: 'Titre de journal, texte de site : le contraste fait la hiérarchie.',
  },
  {
    id: 'bricolage',
    name: 'Grotesque de caractère',
    vibes: ['ludique', 'retro', 'audacieux'],
    sectors: ['Café', 'Restaurant', 'Mode'],
    display: 'Bricolage Grotesque', body: 'Schibsted Grotesk', condensed: 'Big Shoulders Display', serif: 'Fraunces', script: 'Comico',
    titleWeight: 800, microWeight: 600, titleTrack: -0.03, microTrack: 0.1,
    note: 'Un grotesque qui a des angles : de la personnalité sans déguisement.',
  },
  {
    id: 'luxe',
    name: 'Didone',
    vibes: ['luxe', 'editorial'],
    sectors: ['Mode', 'Beauté'],
    display: 'Bodoni Moda', body: 'Cabinet Grotesk', condensed: 'Trench Slab', serif: 'Bodoni Moda', script: 'Rosaline',
    titleWeight: 500, microWeight: 500, titleTrack: 0.01, microTrack: 0.3,
    note: 'Contraste extrême, capitales très espacées : le vocabulaire du luxe.',
  },
  {
    id: 'atelier',
    name: 'Atelier',
    vibes: ['tech', 'sobre', 'minimal'],
    sectors: ['Tech', 'Autre'],
    display: 'Clash Grotesk', body: 'Satoshi', condensed: 'Teko', serif: 'Recia', script: 'Telma',
    titleWeight: 500, microWeight: 500, titleTrack: -0.015, microTrack: 0.26,
    note: 'Grotesque neutre, petites capitales étalées, air de studio.',
  },
  {
    id: 'street',
    name: 'Street',
    // Pas 'retro' : « authentique » et « artisanal » lisent retro dans le ton
    // d'une trattoria, et le pochoir de rue n'est pas ce que ces mots veulent
    // dire. Le rétro chaleureux vit dans « Gras brut » et « Bricolage ».
    vibes: ['audacieux'],
    sectors: ['Sport', 'Mode', 'Restaurant'],
    display: 'Bespoke Stencil', body: 'Excon', condensed: 'Expose', serif: 'Bespoke Serif', script: 'Comico',
    titleWeight: 800, microWeight: 700, titleTrack: -0.02, microTrack: 0.12,
    note: 'Pochoir et condensé : le vocabulaire de la rue, assumé.',
  },
  {
    id: 'maison',
    name: 'Grotesque de maison',
    vibes: ['sobre', 'minimal', 'editorial'],
    sectors: ['Retail', 'Autre', 'Restaurant'],
    display: 'Cabinet Grotesk', body: 'Switzer', condensed: 'Anton', serif: 'Bespoke Serif', script: 'Kalam',
    titleWeight: 800, microWeight: 600, titleTrack: -0.025, microTrack: 0.15,
    note: 'Un grotesque large et lourd, du serif seulement pour respirer.',
  },
  {
    id: 'table',
    name: 'Table',
    vibes: ['chaleureux', 'editorial'],
    sectors: ['Restaurant', 'Café'],
    display: 'Boska', body: 'General Sans', condensed: 'Khand', serif: 'Boska', script: 'Telma',
    titleWeight: 500, microWeight: 600, titleTrack: -0.01, microTrack: 0.2,
    note: 'Serif de carte, sans de service : la typo d\'une bonne table.',
  },
];

export const TYPE_IDENTITY_BY_ID: Record<string, TypeIdentity> =
  Object.fromEntries(TYPE_IDENTITIES.map(t => [t.id, t]));

// ── Choix ────────────────────────────────────────────────────────────────────

/** Empreinte stable d'une chaîne : le même client retombe sur la même typo. */
function empreinte(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
}

/** Mots qui trahissent une personnalité dans le champ « ton » d'une charte. */
const TON_VERS_VIBE: [RegExp, Vibe][] = [
  [/\b(luxe|luxueux|haut de gamme|premium|élégan|raffin|chic)/i, 'luxe'],
  [/\b(minimal|épur|sobre|simple|discret|essentiel)/i, 'minimal'],
  [/\b(chaleur|convivial|famil|proche|humain|bienveill|doux)/i, 'chaleureux'],
  [/\b(fun|ludique|drôle|décal|joyeux|pétillant|jeune)/i, 'ludique'],
  [/\b(audac|punch|direct|franc|cash|percut|énergi|fort)/i, 'audacieux'],
  [/\b(tech|innov|moderne|digital|pointu|futur)/i, 'tech'],
  [/\b(vintage|rétro|retro|artisan|authentique|tradition)/i, 'retro'],
  [/\b(éditorial|editorial|magazine|journal|récit|storytelling)/i, 'editorial'],
  [/\b(pro|sérieux|rigoureux|expert|institutionnel)/i, 'sobre'],
];

export interface TypeIdentityInput {
  name?: string | null;
  sector?: string | null;
  tone?: string | null;
}

/**
 * L'identité typographique d'une marque.
 *
 * Le score n'a pas à être fin : trois signaux (ton, secteur, et l'empreinte du
 * nom) suffisent à ce que deux marques voisines ne se ressemblent pas. Ce qui
 * compte, c'est que le résultat soit STABLE pour un même nom — un feed dont la
 * typo change à chaque post n'est pas une marque.
 */
export function pickTypeIdentity(b: TypeIdentityInput): TypeIdentity {
  const nom = String(b.name ?? '').trim().toLowerCase();
  const secteur = String(b.sector ?? '').trim().toLowerCase();
  const ton = String(b.tone ?? '');
  const vibes: Vibe[] = [];
  for (const [re, v] of TON_VERS_VIBE) if (re.test(ton) && !vibes.includes(v)) vibes.push(v);

  const graine = empreinte(nom || secteur || 'klip');
  const notes = TYPE_IDENTITIES.map((t, i) => {
    let n = 0;
    if (secteur && t.sectors.some(s => s.toLowerCase() === secteur)) n += 2;
    // La PREMIÈRE vibe d'un ensemble est sa personnalité dominante ; les
    // suivantes ne sont que des compatibilités. Les compter à égalité mettait
    // au même niveau une identité faite pour ce ton et une qui le tolère —
    // c'est comme ça qu'une trattoria « chaleureuse et familiale » repartait
    // avec du pochoir de rue.
    for (const v of vibes) {
      const rang = t.vibes.indexOf(v);
      if (rang === 0) n += 2.2;
      else if (rang > 0) n += 1.4;
    }
    // Départage stable, et volontairement plus petit qu'un signal de ton : sans
    // lui, tous les restaurants recevraient la première identité de la liste et
    // on aurait remplacé un générique par huit ; trop grand, il déciderait à la
    // place du ton.
    n += ((graine + i * 2654435761) % 1000) / 1250;
    return { t, n };
  });
  notes.sort((a, b2) => b2.n - a.n);
  return notes[0].t;
}
