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

export interface GlTransition { id: string; name: string; glyph: string; glsl: string }

export const GL_TRANSITIONS: GlTransition[] = [
  {
    id: "glpixel", name: "Pixellisation", glyph: "▩",
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
    id: "gldissolve", name: "Dissolution", glyph: "⁙",
    glsl: `
vec4 transition(vec2 uv) {
  float n = alea(floor(uv * vec2(260.0, 260.0 / max(ratio, 0.001))));
  return mix(getFromColor(uv), getToColor(uv), smoothstep(n, n + 0.12, progress * 1.12));
}`,
  },
  {
    id: "glripple", name: "Ondulation", glyph: "≈",
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
    id: "glwarp", name: "Distorsion", glyph: "⌇",
    glsl: `
vec4 transition(vec2 uv) {
  float amp = 0.4 * sin(progress * 3.14159);
  vec2 a = uv + vec2(amp * progress, 0.0);
  vec2 b = uv - vec2(amp * (1.0 - progress), 0.0);
  return mix(getFromColor(a), getToColor(b), progress);
}`,
  },
  {
    id: "glrgb", name: "Éclatement RVB", glyph: "⧉",
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
    id: "glburn", name: "Brûlure", glyph: "✹",
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
    id: "glvortex", name: "Vortex", glyph: "❋",
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
