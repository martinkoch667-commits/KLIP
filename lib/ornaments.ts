// Ornements graphiques de l'éditeur : flèches, traits, étoiles, rubans, bulles.
//
// POURQUOI ILS SONT DESSINÉS ICI PLUTÔT QU'ACHETÉS. Mesuré le 2026-09-03 :
// les fonds de musée en domaine public (Met, Smithsonian) rendent pour « arrow »
// des Livres des morts égyptiens. Ils valent pour la matière et la gravure, pas
// pour l'ornement social. Les banques qui l'ont, elles, interdisent presque
// toutes qu'un utilisateur final publie leur contenu (licence « Tools » d'Envato)
// ou n'ont pas d'API (Rawpixel).
//
// Or ces éléments sont des formes vectorielles simples. Les dessiner coûte une
// fois ce qu'un abonnement coûte chaque mois, et surtout : ILS PRENNENT LA
// COULEUR DE LA MARQUE. Un PNG acheté est figé, le violet d'un client resterait
// violet chez tous les autres. C'est le seul argument qui compte vraiment ici.
//
// Tracés à main levée volontairement irrégulière : un trait parfaitement droit
// se lit comme une icône d'interface, pas comme une annotation.

export type OrnementCategorie = 'fleches' | 'traits' | 'eclats' | 'rubans' | 'bulles' | 'formes';

export type Ornement = {
  id: string;
  nom: string;
  cat: OrnementCategorie;
  /** Boîte du tracé. Non carrée pour les traits et rubans, sinon ils flottent. */
  vb: string;
  /** Le tracé, `%C%` remplacé par la couleur choisie. */
  d: string;
};

export const CATEGORIES: { id: OrnementCategorie; label: string }[] = [
  { id: 'fleches', label: 'Flèches' },
  { id: 'traits', label: 'Traits' },
  { id: 'eclats', label: 'Éclats' },
  { id: 'rubans', label: 'Rubans' },
  { id: 'bulles', label: 'Bulles' },
  { id: 'formes', label: 'Formes' },
];

// Raccourcis : `t` un tracé au trait, `p` un tracé plein.
const t = (d: string, w = 7, extra = '') =>
  `<path d="${d}" fill="none" stroke="%C%" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`;
const p = (d: string) => `<path d="${d}" fill="%C%"/>`;

export const ORNEMENTS: Ornement[] = [
  // ── Flèches ───────────────────────────────────────────────────────────────
  { id: 'fleche-courbe', nom: 'Flèche courbe', cat: 'fleches', vb: '0 0 200 120',
    d: t('M14 96C46 34 118 10 178 28') + t('M178 28l-30 6M178 28l-8 30') },
  { id: 'fleche-boucle', nom: 'Flèche en boucle', cat: 'fleches', vb: '0 0 200 140',
    d: t('M18 122c26-8 52-34 44-62-6-22-40-22-46 2-8 30 32 60 74 62 34 2 66-16 88-46') + t('M178 78l6 32M178 78l24 14') },
  { id: 'fleche-droite', nom: 'Flèche à main levée', cat: 'fleches', vb: '0 0 200 80',
    d: t('M12 42c48-6 108-8 176-4') + t('M162 20l26 18-26 20') },
  { id: 'fleche-epaisse', nom: 'Flèche pleine', cat: 'fleches', vb: '0 0 200 110',
    d: p('M8 74c40-46 96-62 150-52l-8-30 46 44-46 42 8-30C112 40 62 54 26 92z') },
  { id: 'fleche-brisee', nom: 'Flèche brisée', cat: 'fleches', vb: '0 0 200 120',
    d: t('M16 24l52 62 40-36 74 44') + t('M182 94l-32-6M182 94l-12-30') },
  { id: 'fleche-double', nom: 'Double flèche', cat: 'fleches', vb: '0 0 200 80',
    d: t('M30 40h140') + t('M52 20L28 40l24 20') + t('M148 20l24 20-24 20') },

  // ── Traits ────────────────────────────────────────────────────────────────
  { id: 'souligne', nom: 'Souligné', cat: 'traits', vb: '0 0 240 40',
    d: t('M10 24c62-10 148-14 220-6', 8) },
  { id: 'souligne-double', nom: 'Souligné double', cat: 'traits', vb: '0 0 240 56',
    d: t('M10 18c64-10 150-12 220-4', 7) + t('M22 40c58-8 138-10 200-4', 5) },
  { id: 'ondule', nom: 'Ondulé', cat: 'traits', vb: '0 0 240 48',
    d: t('M8 26c20-22 40 22 60 0s40-22 60 0 40 22 60 0 40-22 44-6', 7) },
  { id: 'zigzag', nom: 'Zigzag', cat: 'traits', vb: '0 0 240 48',
    d: t('M8 34l28-22 28 22 28-22 28 22 28-22 28 22 28-22', 7) },
  { id: 'biffure', nom: 'Biffure', cat: 'traits', vb: '0 0 240 60',
    d: t('M12 38c70-16 150-20 216-14', 7) + t('M18 22c70 12 152 16 214 8', 5) },
  { id: 'accolade', nom: 'Accolade', cat: 'traits', vb: '0 0 80 200',
    d: t('M58 10c-20 2-26 10-26 30v40c0 14-6 18-18 20 12 2 18 6 18 20v40c0 20 6 28 26 30', 7) },
  { id: 'cercle-entoure', nom: 'Cerclé à la main', cat: 'traits', vb: '0 0 220 140',
    d: t('M156 22C104 4 34 16 18 56c-14 36 42 68 106 66 52-2 92-26 88-50-4-22-46-40-98-38', 7) },
  { id: 'trait-pinceau', nom: 'Trait de pinceau', cat: 'traits', vb: '0 0 240 60',
    d: p('M10 38c48-16 104-24 164-22 24 0 48 2 62 8-16 8-42 12-68 14-56 4-112 8-158 20-6-6-6-14 0-20z') },

  // ── Éclats ────────────────────────────────────────────────────────────────
  { id: 'etincelle', nom: 'Étincelle', cat: 'eclats', vb: '0 0 120 120',
    d: p('M60 4c6 34 22 50 56 56-34 6-50 22-56 56-6-34-22-50-56-56 34-6 50-22 56-56z') },
  { id: 'etincelles-trois', nom: 'Trois étincelles', cat: 'eclats', vb: '0 0 160 140',
    d: p('M54 10c5 26 17 38 43 43-26 5-38 17-43 43-5-26-17-38-43-43 26-5 38-17 43-43z')
     + p('M124 62c3 15 10 22 25 25-15 3-22 10-25 25-3-15-10-22-25-25 15-3 22-10 25-25z')
     + p('M28 96c2 11 7 16 18 18-11 2-16 7-18 18-2-11-7-16-18-18 11-2 16-7 18-18z') },
  { id: 'etoile-cinq', nom: 'Étoile', cat: 'eclats', vb: '0 0 120 120',
    d: p('M60 6l16 36 40 4-30 27 9 39-35-21-35 21 9-39L4 46l40-4z') },
  { id: 'soleil', nom: 'Rayons', cat: 'eclats', vb: '0 0 140 140',
    d: t('M70 6v22M70 112v22M6 70h22M112 70h22M25 25l16 16M99 99l16 16M115 25L99 41M41 99l-16 16', 7)
     + t('M70 44a26 26 0 100 52 26 26 0 100-52', 6) },
  { id: 'eclat-explosion', nom: 'Éclat', cat: 'eclats', vb: '0 0 140 140',
    d: p('M70 4l13 32 26-22-10 33 34-4-27 22 27 22-34-4 10 33-26-22-13 32-13-32-26 22 10-33-34 4 27-22-27-22 34 4-10-33 26 22z') },
  { id: 'confettis', nom: 'Confettis', cat: 'eclats', vb: '0 0 160 160',
    d: p('M22 20l16 6-6 16-16-6z') + p('M126 14l16 8-8 16-16-8z') + p('M96 52l12 5-5 12-12-5z')
     + p('M36 84l14 6-6 14-14-6z') + p('M134 92l12 6-6 12-12-6z') + p('M74 118l16 7-7 16-16-7z')
     + p('M18 128l11 5-5 11-11-5z') + p('M118 136l12 5-5 12-12-5z') },

  // ── Rubans et étiquettes ──────────────────────────────────────────────────
  { id: 'scotch', nom: 'Scotch', cat: 'rubans', vb: '0 0 220 70',
    d: `<path d="M12 20l196-14 8 40-196 16z" fill="%C%" opacity="0.55"/>`
     + t('M12 20l196-14M20 62l196-16', 3, ' opacity="0.8"') },
  { id: 'ruban', nom: 'Ruban', cat: 'rubans', vb: '0 0 240 90',
    d: p('M20 14h200l-26 30 26 30H20l26-30z') },
  { id: 'banderole', nom: 'Banderole', cat: 'rubans', vb: '0 0 240 100',
    d: p('M8 30h224v42H8z') + p('M8 30L-2 12l24 4zM232 30l10-18-24 4z') },
  { id: 'cachet', nom: 'Cachet', cat: 'rubans', vb: '0 0 160 120',
    d: t('M14 60c0-26 30-44 66-44s66 18 66 44-30 44-66 44-66-18-66-44z', 7)
     + t('M26 60c0-19 24-33 54-33s54 14 54 33-24 33-54 33-54-14-54-33z', 3) },
  { id: 'etiquette', nom: 'Étiquette', cat: 'rubans', vb: '0 0 200 90',
    d: p('M8 12h150l34 33-34 33H8z') + `<circle cx="150" cy="45" r="8" fill="#fff"/>` },
  { id: 'coche', nom: 'Coche', cat: 'rubans', vb: '0 0 120 100',
    d: t('M14 54l30 30L106 18', 12) },

  // ── Bulles ────────────────────────────────────────────────────────────────
  { id: 'bulle-bd', nom: 'Bulle de BD', cat: 'bulles', vb: '0 0 200 160',
    d: p('M22 14h156c9 0 15 6 15 14v78c0 8-6 14-15 14H92l-40 32 8-32H22c-9 0-15-6-15-14V28c0-8 6-14 15-14z') },
  { id: 'bulle-ronde', nom: 'Bulle ronde', cat: 'bulles', vb: '0 0 200 170',
    d: p('M100 10c52 0 94 28 94 62s-42 62-94 62c-12 0-24-2-34-5l-46 30 12-42C16 106 6 90 6 72 6 38 48 10 100 10z') },
  { id: 'bulle-pensee', nom: 'Bulle de pensée', cat: 'bulles', vb: '0 0 200 170',
    d: p('M96 12c50 0 90 26 90 58s-40 58-90 58c-16 0-31-3-44-8-20 10-34 12-34 12 8-8 12-18 12-26C16 92 6 78 6 70 6 38 46 12 96 12z')
     + p('M44 132a13 13 0 1026 0 13 13 0 10-26 0z') + p('M22 154a8 8 0 1016 0 8 8 0 10-16 0z') },
  { id: 'guillemets', nom: 'Guillemets', cat: 'bulles', vb: '0 0 180 120',
    d: p('M12 96c0-38 16-64 48-76l8 18c-18 8-28 22-28 38h24v40H12z')
     + p('M96 96c0-38 16-64 48-76l8 18c-18 8-28 22-28 38h24v40H96z') },

  // ── Formes ────────────────────────────────────────────────────────────────
  { id: 'blob', nom: 'Tache', cat: 'formes', vb: '0 0 200 180',
    d: p('M104 8c40-4 78 20 88 56 10 38-14 74-48 92-36 18-84 12-114-16C4 114 4 66 30 38 52 14 76 10 104 8z') },
  { id: 'eclaboussure', nom: 'Éclaboussure', cat: 'formes', vb: '0 0 200 180',
    d: p('M96 6c14 14 12 26 26 30 12 4 24-10 36-2 12 8 2 24 8 34 6 12 24 8 28 22 4 14-14 20-16 34-2 12 12 24 4 34-10 12-26-2-38 2-14 4-16 22-30 22s-16-18-30-22c-12-4-28 10-38-2-8-10 6-22 4-34-2-14-20-20-16-34 4-14 22-10 28-22 6-10-4-26 8-34 12-8 24 6 36 2 14-4 12-16 26-30z') },
  { id: 'cercle-brosse', nom: 'Rond au pinceau', cat: 'formes', vb: '0 0 180 180',
    d: t('M90 14c42 0 76 30 76 68s-34 68-76 68-76-30-76-68c0-32 24-58 58-66', 14) },
  { id: 'arche', nom: 'Arche', cat: 'formes', vb: '0 0 160 200',
    d: p('M80 8c40 0 68 30 68 70v114H12V78C12 38 40 8 80 8z') },
  { id: 'cadre-doodle', nom: 'Cadre à main levée', cat: 'formes', vb: '0 0 220 170',
    d: t('M16 22c66-10 134-12 190-6 6 40 6 90 2 132-64 8-132 8-192 2-4-42-4-88 0-128z', 7) },
  { id: 'coins', nom: 'Coins de cadre', cat: 'formes', vb: '0 0 220 170',
    d: t('M14 52V16h44M206 52V16h-44M14 118v36h44M206 118v36h-44', 8) },
  { id: 'demi-cercle', nom: 'Demi-cercle', cat: 'formes', vb: '0 0 200 110',
    d: p('M8 102C8 48 49 6 100 6s92 42 92 96z') },
  { id: 'goutte', nom: 'Goutte', cat: 'formes', vb: '0 0 140 180',
    d: p('M70 6c34 44 62 76 62 108 0 36-28 62-62 62S8 150 8 114C8 82 36 50 70 6z') },
];

/** Le SVG complet d'un ornement, dans la couleur demandée. */
export function ornementSvg(id: string, couleur: string): string | null {
  const o = ORNEMENTS.find(x => x.id === id);
  if (!o) return null;
  // La couleur vient d'un choix d'interface, mais elle finit dans du balisage :
  // on ne laisse passer qu'un code hexadécimal, jamais une chaîne libre.
  const c = /^#[0-9a-fA-F]{3,8}$/.test(couleur) ? couleur : '#14160F';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${o.vb}">${o.d.split('%C%').join(c)}</svg>`;
}
