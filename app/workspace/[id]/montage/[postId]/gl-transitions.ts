// gl-transitions.ts — les transitions qui demandent un shader.
//
// Un canvas 2D sait déplacer, découper, flouter et fondre une image. Il ne sait
// pas la déformer pixel par pixel : pas d'ondulation, pas de dissolution
// granuleuse, pas de vortex, pas de séparation des couches de couleur. Ces
// effets-là se calculent sur la carte graphique, un pixel à la fois.
//
// Les shaders ci-dessous suivent la convention de GL Transitions
// (gl-transitions.com, MIT) : une fonction `transition(vec2 uv)` qui lit
// `getFromColor` / `getToColor` et `progress`. Ce n'est pas un détail de style :
// c'est ce qui permet de coller telle quelle, plus tard, n'importe laquelle des
// quatre-vingts transitions de leur collection, sans toucher au moteur.
//
// Rien ici ne suppose que WebGL existe. `RenduGl.rendre` renvoie null si le
// contexte manque ou si le shader refuse de compiler ; l'appelant retombe alors
// sur un fondu enchaîné, qui n'est jamais faux.

const SOMMET = `
attribute vec2 pos;
varying vec2 vUv;
void main() {
  vUv = pos * 0.5 + 0.5;
  gl_Position = vec4(pos, 0.0, 1.0);
}`;

// Prélude commun : l'API que chaque transition attend. `flipY` est posé au
// téléversement de la texture, donc uv.y = 1 est bien le HAUT de l'image.
const PRELUDE = `
precision highp float;
uniform sampler2D depuis;
uniform sampler2D vers;
uniform float progress;
uniform float ratio;
varying vec2 vUv;
vec4 getFromColor(vec2 uv) { return texture2D(depuis, clamp(uv, 0.0, 1.0)); }
vec4 getToColor(vec2 uv)   { return texture2D(vers,   clamp(uv, 0.0, 1.0)); }
float alea(vec2 c) { return fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453); }
float bruit(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(alea(i), alea(i + vec2(1.0, 0.0)), u.x),
             mix(alea(i + vec2(0.0, 1.0)), alea(i + vec2(1.0, 1.0)), u.x), u.y);
}
`;

const FIN = `
void main() { gl_FragColor = transition(vUv); }`;

export type GlFamille = "shader" | "lumiere" | "camera" | "3d" | "distorsion" | "bogue" | "masque";
export interface GlTransition { id: string; name: string; glyph: string; glsl: string; family: GlFamille }

export const GL_TRANSITIONS: GlTransition[] = [
  {
    id: "glpixel", family: "shader", name: "Pixellisation", glyph: "▩",
    glsl: `
vec4 transition(vec2 uv) {
  float gros = 1.0 - abs(progress * 2.0 - 1.0);          // maximum au milieu
  // 120 blocs, c'est déjà visible : à 320 la pixellisation ne se voyait qu'une
  // image ou deux, juste avant la bascule.
  float blocs = mix(120.0, 10.0, gros);
  vec2 taille = vec2(blocs, blocs / max(ratio, 0.001));
  vec2 p = (floor(uv * taille) + 0.5) / taille;
  return mix(getFromColor(p), getToColor(p), smoothstep(0.45, 0.55, progress));
}`,
  },
  {
    id: "gldissolve", family: "shader", name: "Dissolution", glyph: "⁙",
    glsl: `
vec4 transition(vec2 uv) {
  float n = alea(floor(uv * vec2(260.0, 260.0 / max(ratio, 0.001))));
  return mix(getFromColor(uv), getToColor(uv), smoothstep(n, n + 0.12, progress * 1.12));
}`,
  },
  {
    id: "glripple", family: "shader", name: "Ondulation", glyph: "≈",
    glsl: `
vec4 transition(vec2 uv) {
  vec2 c = uv - 0.5;
  float d = length(c);
  float amp = 0.055 * sin(progress * 3.14159);
  vec2 dec = (c / max(d, 0.001)) * cos(d * 42.0 - progress * 16.0) * amp;
  return mix(getFromColor(uv + dec), getToColor(uv + dec), progress);
}`,
  },
  {
    id: "glwarp", family: "shader", name: "Distorsion", glyph: "⌇",
    glsl: `
vec4 transition(vec2 uv) {
  float amp = 0.4 * sin(progress * 3.14159);
  vec2 a = uv + vec2(amp * progress, 0.0);
  vec2 b = uv - vec2(amp * (1.0 - progress), 0.0);
  return mix(getFromColor(a), getToColor(b), progress);
}`,
  },
  {
    id: "glrgb", family: "shader", name: "Éclatement RVB", glyph: "⧉",
    glsl: `
vec4 transition(vec2 uv) {
  float pic = sin(progress * 3.14159);
  float amp = 0.05 * pic;
  // Bandes horizontales décalées : c'est ce qui fait lire « glitch » plutôt que
  // « flou de couleur ».
  float bande = (alea(vec2(floor(uv.y * 26.0), floor(progress * 12.0))) - 0.5) * 0.06 * pic;
  vec2 d = vec2(bande, 0.0);
  float r = mix(getFromColor(uv + d + vec2(amp, 0.0)).r, getToColor(uv + d + vec2(amp, 0.0)).r, progress);
  float g = mix(getFromColor(uv + d).g, getToColor(uv + d).g, progress);
  float b = mix(getFromColor(uv + d - vec2(amp, 0.0)).b, getToColor(uv + d - vec2(amp, 0.0)).b, progress);
  return vec4(r, g, b, 1.0);
}`,
  },
  {
    id: "glburn", family: "shader", name: "Brûlure", glyph: "✹",
    glsl: `
vec4 transition(vec2 uv) {
  float n = bruit(uv * vec2(3.2, 3.2 / max(ratio, 0.001)) + progress * 0.2);
  float av = progress * 1.35 - 0.18;
  float seuil = smoothstep(n - 0.09, n + 0.09, av);
  vec4 c = mix(getFromColor(uv), getToColor(uv), seuil);
  float bord = seuil * (1.0 - seuil) * 4.0;              // pic sur la frontière
  vec3 braise = mix(vec3(1.0, 0.35, 0.05), vec3(1.0, 0.85, 0.35), bord);
  return vec4(mix(c.rgb, braise, clamp(bord * 0.95, 0.0, 1.0)), 1.0);
}`,
  },
  {
    id: "glvortex", family: "shader", name: "Vortex", glyph: "❋",
    glsl: `
vec4 transition(vec2 uv) {
  vec2 c = (uv - 0.5) * vec2(max(ratio, 0.001), 1.0);
  float d = length(c);
  float a = 5.5 * sin(progress * 3.14159) * (1.0 - smoothstep(0.0, 0.72, d));
  float s = sin(a), co = cos(a);
  vec2 r = vec2(c.x * co - c.y * s, c.x * s + c.y * co);
  vec2 p = r / vec2(max(ratio, 0.001), 1.0) + 0.5;
  return mix(getFromColor(p), getToColor(p), progress);
}`,
  },

  // ── Lumière ───────────────────────────────────────────────────────────────
  {
    id: "glleak", family: "lumiere", name: "Fuite de lumière", glyph: "☀",
    glsl: `
vec4 transition(vec2 uv) {
  float pic = sin(progress * 3.14159);
  // Une nappe chaude balaie le cadre en diagonale et sature au passage.
  // Nappe ÉTROITE : large, elle noyait toute l'image et la vignette n'était
  // plus qu'un aplat orange. Une fuite de lumière traverse, elle ne remplit pas.
  float bande = 1.0 - smoothstep(0.0, 0.26, abs((uv.x + uv.y) * 0.5 - progress));
  vec3 chaud = vec3(1.0, 0.78, 0.42);
  vec4 c = mix(getFromColor(uv), getToColor(uv), smoothstep(0.35, 0.65, progress));
  float force = clamp(bande * (0.25 + 0.6 * pic), 0.0, 0.92);
  return vec4(mix(c.rgb, chaud, force), 1.0);
}`,
  },
  {
    id: "glflare", family: "lumiere", name: "Éclat", glyph: "✷",
    glsl: `
vec4 transition(vec2 uv) {
  vec2 c = (uv - 0.5) * vec2(max(ratio, 0.001), 1.0);
  float d = length(c);
  float pic = sin(progress * 3.14159);
  float halo = pow(clamp(1.0 - d * 1.7, 0.0, 1.0), 2.5) * pic;
  vec4 m = mix(getFromColor(uv), getToColor(uv), smoothstep(0.3, 0.7, progress));
  return vec4(clamp(m.rgb + halo * 1.5, 0.0, 1.0), 1.0);
}`,
  },
  {
    id: "glstrobe", family: "lumiere", name: "Stroboscope", glyph: "⚡",
    glsl: `
vec4 transition(vec2 uv) {
  float bat = step(0.5, fract(progress * 6.0)) * sin(progress * 3.14159);
  vec4 m = mix(getFromColor(uv), getToColor(uv), smoothstep(0.25, 0.75, progress));
  return vec4(mix(m.rgb, vec3(1.0), bat * 0.75), 1.0);
}`,
  },

  // ── Appareil photo ────────────────────────────────────────────────────────
  {
    id: "glzoomrad", family: "camera", name: "Flou radial", glyph: "◎",
    glsl: `
vec4 transition(vec2 uv) {
  // Filé de zoom : on échantillonne le long du rayon, comme un obturateur lent.
  vec2 c = uv - 0.5;
  float force = 0.28 * sin(progress * 3.14159);
  vec4 acc = vec4(0.0);
  for (int i = 0; i < 10; i++) {
    float f = float(i) / 9.0;
    vec2 pa = 0.5 + c * (1.0 + force * f);
    vec2 pb = 0.5 + c * (1.0 - force * (1.0 - f));
    acc += mix(getFromColor(pa), getToColor(pb), progress);
  }
  return acc / 10.0;
}`,
  },
  {
    id: "glpan", family: "camera", name: "Filé caméra", glyph: "⇢",
    glsl: `
vec4 transition(vec2 uv) {
  float force = 0.5 * sin(progress * 3.14159);
  vec4 acc = vec4(0.0);
  for (int i = 0; i < 8; i++) {
    float f = float(i) / 7.0;
    vec2 pa = uv + vec2(force * f + progress, 0.0);
    vec2 pb = uv + vec2(force * f - (1.0 - progress), 0.0);
    acc += mix(getFromColor(pa), getToColor(pb), progress);
  }
  return acc / 8.0;
}`,
  },
  {
    id: "glfocus", family: "camera", name: "Mise au point", glyph: "◉",
    glsl: `
vec4 transition(vec2 uv) {
  float flou = 0.02 * sin(progress * 3.14159);
  vec4 acc = vec4(0.0);
  for (int i = 0; i < 9; i++) {
    float a = float(i) * 0.698;
    vec2 d = vec2(cos(a), sin(a)) * flou * (0.4 + 0.6 * fract(float(i) * 0.37));
    acc += mix(getFromColor(uv + d), getToColor(uv + d), progress);
  }
  return acc / 9.0;
}`,
  },

  // ── 3D ────────────────────────────────────────────────────────────────────
  {
    id: "glcube", family: "3d", name: "Cube", glyph: "▤",
    glsl: `
vec4 transition(vec2 uv) {
  // Deux faces d'un cube qui tourne : la perspective vient d'un simple
  // rétrécissement vertical fonction de la distance au bord de la face.
  float p = progress;
  if (uv.x > p) {
    float u = (uv.x - p) / max(1.0 - p, 0.001);
    float k = mix(1.0, 0.72, u);                 // la face sortante s'éloigne
    float y = (uv.y - 0.5) / k + 0.5;
    if (y < 0.0 || y > 1.0) return vec4(0.0, 0.0, 0.0, 1.0);
    return getFromColor(vec2(mix(p, 1.0, u), y)) * mix(1.0, 0.55, u);
  }
  float u = uv.x / max(p, 0.001);
  float k = mix(0.72, 1.0, u);                   // la face entrante arrive de loin
  float y = (uv.y - 0.5) / k + 0.5;
  if (y < 0.0 || y > 1.0) return vec4(0.0, 0.0, 0.0, 1.0);
  return getToColor(vec2(u, y)) * mix(0.55, 1.0, u);
}`,
  },
  {
    id: "gldoors", family: "3d", name: "Portes", glyph: "⧓",
    glsl: `
vec4 transition(vec2 uv) {
  // Le plan sortant s'ouvre en deux battants, le nouveau attend derrière.
  float e = progress;
  float dep = e * 0.55;
  if (uv.x < 0.5) {
    float x = uv.x + dep;
    if (x < 0.5) return getFromColor(vec2(x, uv.y)) * (1.0 - e * 0.35);
  } else {
    float x = uv.x - dep;
    if (x > 0.5) return getFromColor(vec2(x, uv.y)) * (1.0 - e * 0.35);
  }
  return getToColor(uv);
}`,
  },
  {
    id: "glflip", family: "3d", name: "Retournement", glyph: "⇋",
    glsl: `
vec4 transition(vec2 uv) {
  float p = progress;
  float demi = p < 0.5 ? p * 2.0 : (1.0 - p) * 2.0;   // largeur restante de la carte
  // La carte ne devient jamais un cheveu : à mi-course la vignette n'était plus
  // qu'un rectangle noir, et on ne voyait pas de quoi il s'agissait.
  float k = max(1.0 - demi, 0.16);
  float x = (uv.x - 0.5) / k + 0.5;
  if (x < 0.0 || x > 1.0) return vec4(0.0, 0.0, 0.0, 1.0);
  vec4 c = p < 0.5 ? getFromColor(vec2(x, uv.y)) : getToColor(vec2(1.0 - x, uv.y));
  return vec4(c.rgb * mix(1.0, 0.5, demi), 1.0);
}`,
  },

  // ── Distorsion ────────────────────────────────────────────────────────────
  {
    id: "glwave", family: "distorsion", name: "Vague", glyph: "∿",
    glsl: `
vec4 transition(vec2 uv) {
  float front = progress * 1.4 - 0.2;
  float d = uv.y - front;
  float onde = sin(d * 22.0) * 0.05 * smoothstep(0.35, 0.0, abs(d));
  vec2 p = uv + vec2(onde, 0.0);
  return mix(getFromColor(p), getToColor(p), smoothstep(0.06, -0.06, d));
}`,
  },
  {
    id: "glstretch", family: "distorsion", name: "Étirement", glyph: "↔",
    glsl: `
vec4 transition(vec2 uv) {
  float pic = sin(progress * 3.14159);
  float k = 1.0 + 1.6 * pic;
  vec2 pa = vec2((uv.x - 0.5) / k + 0.5, uv.y);
  vec2 pb = vec2((uv.x - 0.5) * k + 0.5, uv.y);
  return mix(getFromColor(pa), getToColor(pb), progress);
}`,
  },
  {
    id: "glliquid", family: "distorsion", name: "Liquide", glyph: "◍",
    glsl: `
vec4 transition(vec2 uv) {
  float pic = sin(progress * 3.14159);
  float n = bruit(uv * 5.0 + progress * 1.5);
  float m = bruit(uv * 5.0 - progress * 1.2 + 7.3);
  vec2 d = (vec2(n, m) - 0.5) * 0.22 * pic;
  return mix(getFromColor(uv + d), getToColor(uv + d), progress);
}`,
  },
  {
    id: "glkaleido", family: "distorsion", name: "Kaléidoscope", glyph: "✧",
    glsl: `
vec4 transition(vec2 uv) {
  float pic = sin(progress * 3.14159);
  vec2 c = (uv - 0.5) * vec2(max(ratio, 0.001), 1.0);
  float a = atan(c.y, c.x), r = length(c);
  float parts = mix(1.0, 6.0, pic);
  a = mod(a, 6.28318 / parts);
  a = abs(a - 3.14159 / parts);
  vec2 p = vec2(cos(a), sin(a)) * r / vec2(max(ratio, 0.001), 1.0) + 0.5;
  return mix(getFromColor(p), getToColor(p), progress);
}`,
  },

  // ── Bogue ─────────────────────────────────────────────────────────────────
  {
    id: "glblocks", family: "bogue", name: "Blocs", glyph: "▦",
    glsl: `
vec4 transition(vec2 uv) {
  float pic = sin(progress * 3.14159);
  vec2 grille = vec2(14.0, 14.0 / max(ratio, 0.001));
  vec2 cellule = floor(uv * grille);
  float r = alea(cellule + floor(progress * 9.0));
  vec2 d = (vec2(alea(cellule + 3.1), alea(cellule + 7.7)) - 0.5) * 0.18 * pic * step(0.55, r);
  vec2 p = uv + d;
  return mix(getFromColor(p), getToColor(p), smoothstep(r * 0.5, r * 0.5 + 0.35, progress));
}`,
  },
  {
    id: "glscan", family: "bogue", name: "Balayage cathodique", glyph: "▬",
    glsl: `
vec4 transition(vec2 uv) {
  float pic = sin(progress * 3.14159);
  float ligne = floor(uv.y * 60.0);
  float dechirure = (alea(vec2(ligne, floor(progress * 14.0))) - 0.5) * 0.3 * pic;
  vec2 p = uv + vec2(dechirure, 0.0);
  vec4 c = mix(getFromColor(p), getToColor(p), progress);
  float raie = 0.86 + 0.14 * step(0.5, fract(uv.y * 130.0));
  return vec4(c.rgb * mix(1.0, raie, pic), 1.0);
}`,
  },
  {
    id: "glnoise", family: "bogue", name: "Neige", glyph: "░",
    glsl: `
vec4 transition(vec2 uv) {
  float pic = sin(progress * 3.14159);
  float n = alea(uv * 900.0 + progress * 53.0);
  vec4 c = mix(getFromColor(uv), getToColor(uv), smoothstep(0.3, 0.7, progress));
  return vec4(mix(c.rgb, vec3(n), pic * 0.85), 1.0);
}`,
  },

  // ── Formes calculées (ce qu'un chemin 2D ne sait pas dessiner) ────────────
  {
    id: "glhex", family: "masque", name: "Hexagones", glyph: "⬡",
    glsl: `
vec4 transition(vec2 uv) {
  // Pavage hexagonal : chaque cellule bascule à son tour, du centre vers les bords.
  float taille = mix(60.0, 14.0, sin(progress * 3.14159));
  vec2 p = vec2(uv.x * max(ratio, 0.001), uv.y) * taille;
  vec2 a = vec2(1.0, 1.7320508);
  vec2 h = a * 0.5;
  vec2 i1 = floor(p / a) * a + h * vec2(1.0, 1.0);
  vec2 i2 = floor((p - h) / a) * a + h * vec2(2.0, 2.0) - h;
  vec2 c = length(p - i1) < length(p - i2) ? i1 : i2;
  float d = length((c / taille) - vec2(0.5 * max(ratio, 0.001), 0.5));
  float seuil = smoothstep(0.0, 0.9, progress * 1.5 - d * 0.9);
  return mix(getFromColor(uv), getToColor(uv), clamp(seuil, 0.0, 1.0));
}`,
  },
  {
    id: "glpolka", family: "masque", name: "Pois", glyph: "⚉",
    glsl: `
vec4 transition(vec2 uv) {
  vec2 g = vec2(11.0, 11.0 / max(ratio, 0.001));
  vec2 c = fract(uv * g) - 0.5;
  vec2 cellule = floor(uv * g);
  // Les pois grossissent de la gauche vers la droite, comme un rideau.
  float retard = cellule.x / g.x;
  float r = clamp((progress * 1.9 - retard * 0.9), 0.0, 1.0) * 0.78;
  return length(c) < r ? getToColor(uv) : getFromColor(uv);
}`,
  },
  {
    id: "glsquares", family: "masque", name: "Carrés", glyph: "▨",
    glsl: `
vec4 transition(vec2 uv) {
  vec2 g = vec2(13.0, 13.0 / max(ratio, 0.001));
  vec2 cellule = floor(uv * g);
  float r = alea(cellule);
  return mix(getFromColor(uv), getToColor(uv), step(r, progress * 1.15));
}`,
  },
  {
    id: "glheart", family: "masque", name: "Coeur", glyph: "♥",
    glsl: `
vec4 transition(vec2 uv) {
  vec2 c = (uv - vec2(0.5, 0.46)) * vec2(max(ratio, 0.001), -1.0) / max(progress * 1.5, 0.001);
  float x = c.x, y = c.y;
  float f = pow(x * x + y * y - 0.09, 3.0) - x * x * y * y * y * 0.09;
  return f < 0.0 ? getToColor(uv) : getFromColor(uv);
}`,
  },
  {
    id: "glslice", family: "masque", name: "Lamelles", glyph: "▥",
    glsl: `
vec4 transition(vec2 uv) {
  float n = 12.0;
  float bande = floor(uv.x * n);
  // Une lamelle sur deux descend, l'autre monte.
  float sens = mod(bande, 2.0) * 2.0 - 1.0;
  float av = clamp(progress * 1.35 - alea(vec2(bande, 1.0)) * 0.3, 0.0, 1.0);
  float y = uv.y + sens * av;
  return (y < 0.0 || y > 1.0) ? getToColor(uv) : mix(getFromColor(vec2(uv.x, y)), getToColor(uv), step(1.0, av));
}`,
  },

  // ── Mouvement composé ─────────────────────────────────────────────────────
  {
    id: "glspinblur", family: "camera", name: "Rotation filée", glyph: "✼",
    glsl: `
vec4 transition(vec2 uv) {
  vec2 c = (uv - 0.5) * vec2(max(ratio, 0.001), 1.0);
  float force = 0.9 * sin(progress * 3.14159);
  vec4 acc = vec4(0.0);
  for (int i = 0; i < 10; i++) {
    float f = float(i) / 9.0;
    float a1 = force * f, a2 = -force * (1.0 - f);
    vec2 ra = vec2(c.x * cos(a1) - c.y * sin(a1), c.x * sin(a1) + c.y * cos(a1));
    vec2 rb = vec2(c.x * cos(a2) - c.y * sin(a2), c.x * sin(a2) + c.y * cos(a2));
    vec2 pa = ra / vec2(max(ratio, 0.001), 1.0) + 0.5;
    vec2 pb = rb / vec2(max(ratio, 0.001), 1.0) + 0.5;
    acc += mix(getFromColor(pa), getToColor(pb), progress);
  }
  return acc / 10.0;
}`,
  },
  {
    id: "glecho", family: "camera", name: "Écho", glyph: "◫",
    glsl: `
vec4 transition(vec2 uv) {
  // Traînée d'images fantômes, comme un obturateur qui traîne sur un zoom.
  vec2 c = uv - 0.5;
  vec4 acc = vec4(0.0);
  float poids = 0.0;
  for (int i = 0; i < 6; i++) {
    float f = float(i) / 5.0;
    float k = 1.0 + 0.5 * f * sin(progress * 3.14159);
    float w = 1.0 - f * 0.7;
    acc += mix(getFromColor(0.5 + c * k), getToColor(0.5 + c / k), progress) * w;
    poids += w;
  }
  return acc / poids;
}`,
  },
  {
    id: "glmirror", family: "distorsion", name: "Miroir", glyph: "◪",
    glsl: `
vec4 transition(vec2 uv) {
  float pic = sin(progress * 3.14159);
  // Le cadre se plie en deux : la moitié droite devient le reflet de la gauche.
  float x = mix(uv.x, uv.x < 0.5 ? uv.x : 1.0 - uv.x, pic);
  vec2 p = vec2(x, uv.y);
  return mix(getFromColor(p), getToColor(p), progress);
}`,
  },
  {
    id: "glshatter", family: "bogue", name: "Éclats", glyph: "✧",
    glsl: `
vec4 transition(vec2 uv) {
  // Éclats de verre : des cellules irrégulières partent chacune dans son sens.
  vec2 g = vec2(9.0, 9.0 / max(ratio, 0.001));
  vec2 cellule = floor(uv * g);
  float r = alea(cellule);
  float dep = clamp(progress * 1.6 - r * 0.6, 0.0, 1.0);
  vec2 dir = normalize(vec2(alea(cellule + 1.7) - 0.5, alea(cellule + 4.3) - 0.5) + 0.0001);
  vec2 p = uv + dir * dep * 0.35;
  vec4 depuisC = getFromColor(p);
  return mix(depuisC, getToColor(uv), smoothstep(0.55, 1.0, dep));
}`,
  },
  {
    id: "glmelt", family: "distorsion", name: "Fonte", glyph: "⩗",
    glsl: `
vec4 transition(vec2 uv) {
  // La matière coule vers le bas, plus vite là où l'image est sombre.
  vec4 d = getFromColor(uv);
  float lum = dot(d.rgb, vec3(0.299, 0.587, 0.114));
  float coule = progress * (1.25 - lum * 0.75);
  float y = uv.y + coule;
  if (y > 1.0) return getToColor(uv);
  return mix(getFromColor(vec2(uv.x, y)), getToColor(uv), smoothstep(0.8, 1.0, progress));
}`,
  },
  {
    id: "glchroma", family: "lumiere", name: "Bavure couleur", glyph: "◐",
    glsl: `
vec4 transition(vec2 uv) {
  float pic = sin(progress * 3.14159);
  vec2 c = (uv - 0.5);
  vec4 acc = vec4(0.0);
  for (int i = 0; i < 6; i++) {
    float f = float(i) / 5.0;
    float k = 1.0 + 0.12 * f * pic;
    vec2 p = 0.5 + c * k;
    vec4 m = mix(getFromColor(p), getToColor(p), progress);
    // Chaque échantillon ne garde qu'une teinte : les couleurs se séparent en
    // s'éloignant du centre, comme une optique bon marché.
    acc.r += m.r * step(f, 0.34);
    acc.g += m.g * step(0.33, f) * step(f, 0.67);
    acc.b += m.b * step(0.66, f);
  }
  return vec4(acc.r / 2.0, acc.g / 2.0, acc.b / 2.0, 1.0);
}`,
  },
  {
    id: "glfilm", family: "lumiere", name: "Pellicule", glyph: "▤",
    glsl: `
vec4 transition(vec2 uv) {
  // Défilement vertical d'une pellicule, avec le noir de l'interimage.
  float pos = fract(progress);
  float y = uv.y + progress * 1.15;
  float inter = smoothstep(0.02, 0.0, abs(fract(y) - 0.5) - 0.46);
  vec4 c = y > 1.0 ? getToColor(vec2(uv.x, fract(y))) : getFromColor(vec2(uv.x, y));
  float grain = (alea(uv * 700.0 + pos * 31.0) - 0.5) * 0.12;
  return vec4(clamp(c.rgb * (1.0 - inter) + grain, 0.0, 1.0), 1.0);
}`,
  },
];

export const GL_IDS = new Set(GL_TRANSITIONS.map((t) => t.id));
export const estTransitionGl = (id: string | undefined): boolean => !!id && GL_IDS.has(id);

type Source = TexImageSource;

/** Le moteur. Un seul par page : un contexte WebGL coûte cher à ouvrir, et il y
 *  a une limite basse au nombre de contextes vivants dans un onglet. */
class RenduGl {
  private canvas: HTMLCanvasElement | null = null;
  private gl: WebGLRenderingContext | null = null;
  private programmes = new Map<string, WebGLProgram | null>();
  private texDepuis: WebGLTexture | null = null;
  private texVers: WebGLTexture | null = null;
  private hs = false; // hors service : on a essayé, ça n'a pas marché, on n'insiste plus

  private init(): boolean {
    if (this.gl) return true;
    if (this.hs || typeof document === "undefined") return false;
    const cv = document.createElement("canvas");
    const gl = (cv.getContext("webgl", { premultipliedAlpha: false, alpha: false })
      || cv.getContext("experimental-webgl", { premultipliedAlpha: false, alpha: false })) as WebGLRenderingContext | null;
    if (!gl) { this.hs = true; return false; }
    this.canvas = cv; this.gl = gl;

    const tampon = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, tampon);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    this.texDepuis = this.creerTexture(gl);
    this.texVers = this.creerTexture(gl);
    return true;
  }

  private creerTexture(gl: WebGLRenderingContext): WebGLTexture | null {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    // CLAMP_TO_EDGE : une déformation qui sort du cadre étire le bord au lieu de
    // reboucler de l'autre côté, ce qui donnerait une couture visible.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return t;
  }

  private compiler(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
    const sh = gl.createShader(type);
    if (!sh) return null;
    gl.shaderSource(sh, source);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.warn("[gl-transitions] shader refusé :", gl.getShaderInfoLog(sh));
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  private programme(id: string): WebGLProgram | null {
    if (this.programmes.has(id)) return this.programmes.get(id) ?? null;
    const gl = this.gl!;
    const def = GL_TRANSITIONS.find((t) => t.id === id);
    if (!def) { this.programmes.set(id, null); return null; }
    const vs = this.compiler(gl, gl.VERTEX_SHADER, SOMMET);
    const fs = this.compiler(gl, gl.FRAGMENT_SHADER, PRELUDE + def.glsl + FIN);
    if (!vs || !fs) { this.programmes.set(id, null); return null; }
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn("[gl-transitions] édition de liens refusée :", gl.getProgramInfoLog(prog));
      this.programmes.set(id, null);
      return null;
    }
    this.programmes.set(id, prog);
    return prog;
  }

  /** Rend une image de transition et renvoie le canvas qui la porte, ou null si
   *  WebGL n'est pas disponible ici. Le canvas est REUTILISÉ d'un appel à
   *  l'autre : à recopier tout de suite, pas à garder. */
  rendre(depuis: Source, vers: Source, progress: number, id: string, w: number, h: number): HTMLCanvasElement | null {
    if (!this.init()) return null;
    const gl = this.gl!, cv = this.canvas!;
    const prog = this.programme(id);
    if (!prog) return null;
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    gl.viewport(0, 0, w, h);
    gl.useProgram(prog);

    const pos = gl.getAttribLocation(prog, "pos");
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texDepuis);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, depuis);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.texVers);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, vers);

    gl.uniform1i(gl.getUniformLocation(prog, "depuis"), 0);
    gl.uniform1i(gl.getUniformLocation(prog, "vers"), 1);
    gl.uniform1f(gl.getUniformLocation(prog, "progress"), Math.max(0, Math.min(1, progress)));
    gl.uniform1f(gl.getUniformLocation(prog, "ratio"), h > 0 ? w / h : 1);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return cv;
  }
}

let moteur: RenduGl | null = null;
export function moteurGl(): RenduGl {
  if (!moteur) moteur = new RenduGl();
  return moteur;
}
