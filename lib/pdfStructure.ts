// lib/pdfStructure.ts : lire la STRUCTURE d'un PDF, pas ses pixels.
//
// POURQUOI CE FICHIER
// L'API Connect de Canva n'expose nulle part le contenu d'un design. On peut
// lister les designs d'un utilisateur, lire leurs métadonnées et leurs
// vignettes, et les EXPORTER. C'est tout : la lecture des calques (taille,
// position, texte) n'existe que dans l'Apps SDK, c'est-à-dire à l'intérieur
// d'une iframe hébergée par Canva, hors d'atteinte d'un serveur.
//
// Il reste un chemin, et un seul : l'export PDF. Contrairement au PNG, il n'est
// pas aplati. Le texte y reste du texte, avec sa position, son corps, sa police
// et sa couleur ; les aplats y restent des rectangles remplis. C'est exactement
// ce qu'il faut pour reconstruire un modèle KLIP.
//
// CE QU'ON EN TIRE, ET CE QU'ON N'EN TIRE PAS
// On lit la GÉOMÉTRIE, les TEXTES et les COULEURS. On ne sort JAMAIS les images
// d'un design, et c'est une décision, pas une limite technique : la licence de
// contenu Canva interdit d'utiliser son contenu hors d'un design Canva ou de
// façon autonome, et rien dans un export ne distingue de façon fiable la photo
// du client d'une photo de la banque Canva. Chaque image devient donc une ZONE
// PHOTO, ce qui est de toute façon ce qu'un modèle KLIP veut : un emplacement à
// remplir, pas une image gravée.
//
// PORTÉE
// Un lecteur suffisant pour des documents d'export, pas un moteur PDF. Il gère
// les objets classiques et les flux d'objets, FlateDecode, les rectangles
// remplis, le texte avec sa table ToUnicode. Il ne gère ni les tracés courbes,
// ni les motifs, ni les transparences douces : ce qu'il ne comprend pas, il
// l'ignore, et l'appelant retombe sur l'image aplatie.

import { inflateSync } from 'zlib';

export interface PdfTextRun {
  text: string;
  /** Rang de peinture dans la page : c'est lui, et lui seul, qui donne l'ordre
   *  des calques. Les trois listes séparées le perdraient sinon. */
  ordre: number;
  /** Coin haut-gauche approché, en points, origine en haut à gauche de la page. */
  x: number; y: number;
  /** Corps effectif, en points, après la matrice de texte ET la matrice courante. */
  size: number;
  /** Nom de la police, préfixe de sous-ensemble retiré. */
  font: string;
  color: string;
  bold: boolean;
  italic: boolean;
}

export interface PdfRect {
  ordre: number;
  x: number; y: number; w: number; h: number; color: string;
  /** Le tracé portait des courbes : pastille, pilule, cercle. */
  arrondi: boolean;
}
export interface PdfImageBox { ordre: number; x: number; y: number; w: number; h: number }

export interface PdfPage {
  width: number; height: number;
  texts: PdfTextRun[];
  rects: PdfRect[];
  images: PdfImageBox[];
}

// ── Valeurs PDF ──────────────────────────────────────────────────────────────

type PdfName = { name: string };
type PdfRef = { num: number; gen: number };
type PdfDict = Map<string, PdfValue>;
type PdfValue = number | string | boolean | null | PdfName | PdfRef | PdfValue[] | PdfDict;

const isName = (v: PdfValue): v is PdfName => !!v && typeof v === 'object' && 'name' in (v as object);
const isRef = (v: PdfValue): v is PdfRef => !!v && typeof v === 'object' && 'num' in (v as object);
const isDict = (v: PdfValue): v is PdfDict => v instanceof Map;

const WS = new Set([0x00, 0x09, 0x0a, 0x0c, 0x0d, 0x20]);
const DELIM = new Set([0x28, 0x29, 0x3c, 0x3e, 0x5b, 0x5d, 0x7b, 0x7d, 0x2f, 0x25]);

function latin(b: Uint8Array, from: number, to: number): string {
  let s = '';
  for (let k = from; k < to; k++) s += String.fromCharCode(b[k]);
  return s;
}

/** Analyseur de syntaxe PDF, partagé par les objets et les flux de contenu. */
class Lexer {
  buf: Uint8Array;
  i = 0;
  constructor(buf: Uint8Array, at = 0) { this.buf = buf; this.i = at; }

  skip() {
    for (;;) {
      while (this.i < this.buf.length && WS.has(this.buf[this.i])) this.i++;
      if (this.buf[this.i] === 0x25) { // commentaire
        while (this.i < this.buf.length && this.buf[this.i] !== 0x0a && this.buf[this.i] !== 0x0d) this.i++;
        continue;
      }
      return;
    }
  }

  /** Mot brut (opérateur, mot-clé, nombre) sans interpréter. */
  word(): string {
    this.skip();
    const start = this.i;
    while (this.i < this.buf.length && !WS.has(this.buf[this.i]) && !DELIM.has(this.buf[this.i])) this.i++;
    if (this.i === start) this.i++; // caractère isolé : ne jamais boucler
    return latin(this.buf, start, this.i);
  }

  name(): PdfName {
    this.i++;
    const start = this.i;
    while (this.i < this.buf.length && !WS.has(this.buf[this.i]) && !DELIM.has(this.buf[this.i])) this.i++;
    const raw = latin(this.buf, start, this.i);
    return { name: raw.replace(/#([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))) };
  }

  /** Chaîne littérale entre parenthèses, échappements et imbrications compris. */
  literal(): string {
    this.i++;
    let depth = 1;
    const out: number[] = [];
    while (this.i < this.buf.length) {
      const c = this.buf[this.i++];
      if (c === 0x5c) {
        const n = this.buf[this.i++];
        const simple: Record<number, number> = { 0x6e: 10, 0x72: 13, 0x74: 9, 0x62: 8, 0x66: 12 };
        if (simple[n] !== undefined) out.push(simple[n]);
        else if (n >= 0x30 && n <= 0x37) {
          let o = n - 0x30;
          for (let k = 0; k < 2; k++) {
            const d = this.buf[this.i];
            if (d >= 0x30 && d <= 0x37) { o = o * 8 + (d - 0x30); this.i++; } else break;
          }
          out.push(o & 255);
        } else if (n === 0x0a) { /* continuation de ligne */ }
        else out.push(n);
        continue;
      }
      if (c === 0x28) depth++;
      if (c === 0x29) { depth--; if (!depth) break; }
      out.push(c);
    }
    return String.fromCharCode(...out);
  }

  /** Chaîne hexadécimale. */
  hex(): string {
    this.i++;
    let h = '';
    while (this.i < this.buf.length && this.buf[this.i] !== 0x3e) {
      const c = this.buf[this.i++];
      if (!WS.has(c)) h += String.fromCharCode(c);
    }
    this.i++;
    if (h.length % 2) h += '0';
    let s = '';
    for (let k = 0; k < h.length; k += 2) s += String.fromCharCode(parseInt(h.slice(k, k + 2), 16));
    return s;
  }

  value(): PdfValue {
    this.skip();
    const c = this.buf[this.i];
    if (c === undefined) return null;
    if (c === 0x2f) return this.name();
    if (c === 0x28) return this.literal();
    if (c === 0x5b) {
      this.i++;
      const arr: PdfValue[] = [];
      for (;;) {
        this.skip();
        if (this.buf[this.i] === 0x5d) { this.i++; break; }
        if (this.i >= this.buf.length) break;
        const before = this.i;
        arr.push(this.value());
        if (this.i === before) { this.i++; }
      }
      return arr;
    }
    if (c === 0x3c) {
      if (this.buf[this.i + 1] === 0x3c) {
        this.i += 2;
        const d: PdfDict = new Map();
        for (;;) {
          this.skip();
          if (this.buf[this.i] === 0x3e && this.buf[this.i + 1] === 0x3e) { this.i += 2; break; }
          if (this.i >= this.buf.length) break;
          if (this.buf[this.i] !== 0x2f) { this.i++; continue; }
          const k = this.name().name;
          d.set(k, this.value());
        }
        return d;
      }
      return this.hex();
    }
    // Nombre, référence indirecte, ou mot-clé.
    const save = this.i;
    const w = this.word();
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(w)) {
      // « 12 0 R » est une référence, « 12 0 » deux nombres : il faut regarder devant.
      const apresNombre = this.i;
      this.skip();
      const save2 = this.i;
      const w2 = this.word();
      if (/^\d+$/.test(w2)) {
        this.skip();
        const save3 = this.i;
        if (this.word() === 'R') return { num: parseInt(w, 10), gen: parseInt(w2, 10) };
        this.i = save3;
      }
      this.i = apresNombre;
      void save2;
      return parseFloat(w);
    }
    if (w === 'true') return true;
    if (w === 'false') return false;
    if (w === 'null') return null;
    if (w === '') { this.i = save + 1; return null; }
    return { name: `__kw_${w}` };
  }
}

// ── Le document ──────────────────────────────────────────────────────────────

interface PdfObject { dict: PdfDict | null; value: PdfValue; stream: Uint8Array | null }

class PdfDoc {
  buf: Uint8Array;
  objects = new Map<number, PdfObject>();

  constructor(buf: Uint8Array) {
    this.buf = buf;
    this.scan();
    this.expandObjectStreams();
  }

  /**
   * Repérage des objets par BALAYAGE, sans passer par la table xref.
   *
   * C'est volontaire : la table xref d'un export peut être compressée, décalée
   * après une signature, ou simplement fausse, et un lecteur qui en dépend rend
   * alors zéro objet sur un fichier parfaitement lisible. Le balayage coûte une
   * passe sur le fichier et ne se trompe jamais de la même façon.
   */
  private scan() {
    const b = this.buf;
    const text = latin(b, 0, b.length);
    const re = /(\d+)\s+(\d+)\s+obj\b/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const num = parseInt(m[1], 10);
      const at = m.index + m[0].length;
      const lex = new Lexer(b, at);
      let value: PdfValue = null;
      try { value = lex.value(); } catch { continue; }
      const dict = isDict(value) ? value : null;

      let stream: Uint8Array | null = null;
      lex.skip();
      if (latin(b, lex.i, lex.i + 6) === 'stream') {
        let s = lex.i + 6;
        if (b[s] === 0x0d) s++;
        if (b[s] === 0x0a) s++;
        let len = -1;
        const L = dict?.get('Length');
        if (typeof L === 'number') len = L;
        const finAnnoncee = latin(b, s + len, s + len + 20);
        if (len < 0 || s + len > b.length || !/^\s*endstream/.test(finAnnoncee)) {
          // /Length indirect ou faux : on cherche la fin réelle. Un export mal
          // écrit ne doit pas coûter le document entier.
          const end = text.indexOf('endstream', s);
          len = end < 0 ? 0 : end - s;
        }
        stream = b.subarray(s, s + Math.max(0, len));
      }
      this.objects.set(num, { dict, value, stream });
    }
  }

  /** Les objets rangés dans un flux d'objets (/Type /ObjStm) y sont dépliés. */
  private expandObjectStreams() {
    const stms = Array.from(this.objects.values()).filter(o => {
      const t = o.dict?.get('Type');
      return isName(t as PdfValue) && (t as PdfName).name === 'ObjStm';
    });
    for (const o of stms) {
      const data = this.streamData(o);
      if (!data) continue;
      const n = Number(this.resolve(o.dict?.get('N') ?? 0));
      const first = Number(this.resolve(o.dict?.get('First') ?? 0));
      const head = new Lexer(data, 0);
      const pairs: [number, number][] = [];
      for (let k = 0; k < n; k++) {
        const num = parseInt(head.word(), 10);
        const off = parseInt(head.word(), 10);
        if (Number.isNaN(num) || Number.isNaN(off)) break;
        pairs.push([num, off]);
      }
      for (const [num, off] of pairs) {
        if (this.objects.has(num)) continue;
        try {
          const lex = new Lexer(data, first + off);
          const value = lex.value();
          this.objects.set(num, { dict: isDict(value) ? value : null, value, stream: null });
        } catch { /* un objet illisible n'emporte pas les autres */ }
      }
    }
  }

  resolve(v: PdfValue): PdfValue {
    let cur = v;
    for (let k = 0; k < 8 && isRef(cur); k++) cur = this.objects.get((cur as PdfRef).num)?.value ?? null;
    return cur;
  }

  dict(v: PdfValue): PdfDict | null {
    const r = this.resolve(v);
    return isDict(r) ? r : null;
  }

  streamData(o: PdfObject | undefined): Uint8Array | null {
    if (!o?.stream) return null;
    const f = this.resolve(o.dict?.get('Filter') ?? null);
    const noms = isName(f) ? [f.name] : Array.isArray(f) ? f.map(x => (isName(x) ? x.name : '')) : [];
    let data: Uint8Array = o.stream;
    for (const nom of noms) {
      if (nom === 'FlateDecode') {
        try { data = new Uint8Array(inflateSync(Buffer.from(data))); }
        catch {
          // Un flux tronqué reste souvent exploitable sur sa partie valide.
          try { data = new Uint8Array(inflateSync(Buffer.from(data), { finishFlush: 2 })); }
          catch { return null; }
        }
      } else if (nom === 'DCTDecode' || nom === 'JPXDecode') {
        return null; // une image : on ne la sort jamais, voir l'en-tête
      }
    }
    return data;
  }

  objFor(v: PdfValue): PdfObject | undefined {
    return isRef(v) ? this.objects.get(v.num) : undefined;
  }

  /** Les pages du document, dans l'ordre. */
  pages(): PdfDict[] {
    const out: PdfDict[] = [];
    const cat = Array.from(this.objects.values()).find(o => {
      const t = o.dict?.get('Type');
      return isName(t as PdfValue) && (t as PdfName).name === 'Catalog';
    });
    const racine = this.dict(cat?.dict?.get('Pages') ?? null);
    const descendre = (node: PdfDict | null, prof: number) => {
      if (!node || prof > 12 || out.length > 60) return;
      const t = node.get('Type');
      if (isName(t as PdfValue) && (t as PdfName).name === 'Page') { out.push(node); return; }
      const kids = this.resolve(node.get('Kids') ?? null);
      if (Array.isArray(kids)) for (const k of kids) descendre(this.dict(k), prof + 1);
    };
    descendre(racine, 0);
    if (out.length) return out;
    // Sans catalogue lisible, on prend les objets qui se déclarent pages.
    for (const o of Array.from(this.objects.values())) {
      const t = o.dict?.get('Type');
      if (isName(t as PdfValue) && (t as PdfName).name === 'Page' && o.dict) out.push(o.dict);
    }
    return out;
  }

  /** Un attribut de page peut être porté par un parent (héritage PDF). */
  pageAttr(page: PdfDict, key: string): PdfValue {
    let cur: PdfDict | null = page;
    for (let k = 0; k < 12 && cur; k++) {
      const v = cur.get(key);
      if (v !== undefined && v !== null) return this.resolve(v);
      cur = this.dict(cur.get('Parent') ?? null);
    }
    return null;
  }
}

// ── Polices et décodage du texte ─────────────────────────────────────────────

interface FontInfo {
  name: string;
  bold: boolean;
  italic: boolean;
  /** Deux octets par code (Identity-H et compagnie). */
  twoByte: boolean;
  /** Code de glyphe vers caractère, quand le PDF fournit sa table. */
  toUnicode: Map<number, string> | null;
}

function parseToUnicode(src: string): Map<number, string> {
  const map = new Map<number, string>();
  const hexToStr = (h: string) => {
    let s = '';
    for (let i = 0; i + 4 <= h.length; i += 4) {
      const code = parseInt(h.slice(i, i + 4), 16);
      if (!Number.isNaN(code)) s += String.fromCharCode(code);
    }
    return s;
  };
  const bfchar = /beginbfchar([\s\S]*?)endbfchar/g;
  let m: RegExpExecArray | null;
  while ((m = bfchar.exec(src))) {
    const paires = m[1].match(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g) ?? [];
    for (const p of paires) {
      const mm = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/.exec(p);
      if (mm) map.set(parseInt(mm[1], 16), hexToStr(mm[2]));
    }
  }
  const bfrange = /beginbfrange([\s\S]*?)endbfrange/g;
  while ((m = bfrange.exec(src))) {
    const lignes = m[1].match(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g) ?? [];
    for (const l of lignes) {
      const mm = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/.exec(l);
      if (!mm) continue;
      const lo = parseInt(mm[1], 16), hi = parseInt(mm[2], 16), base = parseInt(mm[3], 16);
      for (let k = lo; k <= hi && k - lo < 4096; k++) map.set(k, String.fromCharCode(base + (k - lo)));
    }
  }
  return map;
}

function readFonts(doc: PdfDoc, res: PdfDict | null): Map<string, FontInfo> {
  const out = new Map<string, FontInfo>();
  const fonts = doc.dict(res?.get('Font') ?? null);
  if (!fonts) return out;
  fonts.forEach((ref, key) => {
    const fd = doc.dict(ref);
    if (!fd) return;
    const base = fd.get('BaseFont');
    // « ABCDEF+Poppins-Bold » : le préfixe marque un sous-ensemble, il ne fait
    // pas partie du nom de la police et doit sauter avant toute comparaison.
    let nom = isName(base as PdfValue) ? (base as PdfName).name.replace(/^[A-Z]{6}\+/, '') : 'inconnue';
    const bold = /bold|black|heavy|semibold|extrabold/i.test(nom);
    const italic = /italic|oblique/i.test(nom);
    nom = nom.replace(/[-,_](Regular|Bold|Italic|BoldItalic|Medium|Light|Black|Thin|SemiBold|ExtraBold|Oblique)+$/i, '');

    const sub = doc.resolve(fd.get('Subtype') ?? null);
    const enc = doc.resolve(fd.get('Encoding') ?? null);
    const twoByte = (isName(enc) && /Identity/.test(enc.name))
      || (isName(sub) && sub.name === 'Type0');

    let toUnicode: Map<number, string> | null = null;
    const tu = doc.objFor(fd.get('ToUnicode') ?? null);
    const data = doc.streamData(tu);
    if (data) {
      const parsed = parseToUnicode(latin(data, 0, data.length));
      if (parsed.size) toUnicode = parsed;
    }
    out.set(key, { name: nom, bold, italic, twoByte, toUnicode });
  });
  return out;
}

function decode(s: string, f: FontInfo | undefined): string {
  if (!f) return s;
  if (!f.twoByte && !f.toUnicode) return s;
  const codes: number[] = [];
  if (f.twoByte) for (let i = 0; i + 1 < s.length; i += 2) codes.push((s.charCodeAt(i) << 8) | s.charCodeAt(i + 1));
  else for (let i = 0; i < s.length; i++) codes.push(s.charCodeAt(i));
  let out = '';
  for (const c of codes) out += f.toUnicode?.get(c) ?? (f.twoByte ? '' : String.fromCharCode(c));
  return out;
}

// ── Couleurs ─────────────────────────────────────────────────────────────────

const hex2 = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255))).toString(16).padStart(2, '0');
const rgbHex = (r: number, g: number, b: number) => `#${hex2(r)}${hex2(g)}${hex2(b)}`.toUpperCase();
const cmykHex = (c: number, m: number, y: number, k: number) =>
  rgbHex((1 - c) * (1 - k), (1 - m) * (1 - k), (1 - y) * (1 - k));

// ── Le flux de contenu ───────────────────────────────────────────────────────

type Mat = [number, number, number, number, number, number];
const mul = (a: Mat, b: Mat): Mat => [
  a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3],
  a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3],
  a[4] * b[0] + a[5] * b[2] + b[4], a[4] * b[1] + a[5] * b[3] + b[5],
];
const apply = (m: Mat, x: number, y: number): [number, number] =>
  [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
const echelle = (m: Mat) => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1;

interface Etat { ctm: Mat; fill: string; fillSet: boolean }

/** Aire du polygone rapportée à celle de sa boîte : 1 pour un rectangle, 0,79
 *  pour un cercle, très bas pour un dessin. Formule des lacets. */
function compacite(poly: [number, number][], w: number, h: number): number {
  if (poly.length < 3 || w <= 0 || h <= 0) return 0;
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a / 2) / (w * h);
}

/** Lit une page et rend ce qu'elle contient de reconstructible. */
function readPage(doc: PdfDoc, page: PdfDict): PdfPage {
  const mb = doc.pageAttr(page, 'MediaBox');
  const box = Array.isArray(mb) ? mb.map(v => Number(doc.resolve(v)) || 0) : [0, 0, 595, 842];
  const width = Math.abs(box[2] - box[0]) || 595;
  const height = Math.abs(box[3] - box[1]) || 842;

  const res = doc.dict(doc.pageAttr(page, 'Resources'));
  const fonts = readFonts(doc, res);
  const xobjects = doc.dict(res?.get('XObject') ?? null);

  // Contenu : un flux, ou un tableau de flux à concaténer.
  const parts: Uint8Array[] = [];
  const pousser = (v: PdfValue) => {
    const d = doc.streamData(doc.objFor(v));
    if (d) parts.push(d);
  };
  const contents = page.get('Contents') ?? null;
  const c = doc.resolve(contents);
  if (Array.isArray(contents)) contents.forEach(pousser);
  else if (Array.isArray(c)) c.forEach(pousser);
  else pousser(contents);
  if (!parts.length) return { width, height, texts: [], rects: [], images: [] };

  let total = 0;
  for (const p of parts) total += p.length + 1;
  const flux = new Uint8Array(total);
  let at = 0;
  for (const p of parts) { flux.set(p, at); at += p.length; flux[at++] = 0x0a; }

  const texts: PdfTextRun[] = [];
  const rects: PdfRect[] = [];
  const images: PdfImageBox[] = [];
  let ordre = 0;

  const pile: Etat[] = [];
  let etat: Etat = { ctm: [1, 0, 0, 1, 0, 0], fill: '#000000', fillSet: false };
  let tm: Mat = [1, 0, 0, 1, 0, 0];
  let tlm: Mat = [1, 0, 0, 1, 0, 0];
  let police: FontInfo | undefined;
  let corps = 12;
  let interligne = 0;
  let enTexte = false;

  // LE TRACÉ EN ATTENTE.
  //
  // `re` pose un rectangle, `f` le peint, `n` ou `W` l'annule (c'est une
  // découpe, pas un aplat). Mais un aplat de Canva n'est pas toujours un
  // rectangle : une pastille, une pilule ou un cercle arrivent en `m`/`l`/`c`.
  // Le premier essai ne suivait que `re`, et la pastille jaune du visuel de
  // test disparaissait purement et simplement.
  //
  // On suit donc TOUT tracé, en n'en gardant que sa boîte englobante et de quoi
  // décider s'il s'agit d'une FORME ou d'un DESSIN. Le premier critère essayé
  // était le nombre de segments : faux, parce qu'un moteur de rendu aplatit un
  // simple cercle en cent courbes de Bézier (mesuré : la pastille du visuel de
  // test en comptait 98, elle était donc rejetée comme « illustration »).
  //
  // Le bon critère est la COMPACITÉ : l'aire réellement couverte rapportée à
  // celle de la boîte englobante. Un rectangle la remplit à 100 %, un rectangle
  // arrondi à 95 %, un cercle à 79 %, une pilule à 85 %. Une icône, une flèche
  // dessinée, un logo vectoriel tombent bien plus bas, et il vaut mieux les
  // ignorer que les rendre en gros carré de couleur. Un seul sous-tracé, aussi :
  // un dessin en a plusieurs.
  interface Trace {
    x0: number; y0: number; x1: number; y1: number;
    segments: number; courbes: boolean; sousTraces: number;
    /** Sommets du tracé aplati, pour l'aire. Bornés : un tracé peut être immense. */
    poly: [number, number][];
  }
  // Porté par un objet et non par une variable : `toucher` écrit dedans depuis
  // une fermeture, ce que l'analyse de flux de TypeScript ne suit pas.
  const chemin: { t: Trace | null } = { t: null };
  let curseur: [number, number] = [0, 0];
  const sommet = (x: number, y: number) => {
    const t = chemin.t;
    if (t && t.poly.length < 600) t.poly.push([x, y]);
  };
  const toucher = (x: number, y: number) => {
    const t = chemin.t;
    if (!t) chemin.t = { x0: x, y0: y, x1: x, y1: y, segments: 0, courbes: false, sousTraces: 0, poly: [] };
    else {
      t.x0 = Math.min(t.x0, x); t.y0 = Math.min(t.y0, y);
      t.x1 = Math.max(t.x1, x); t.y1 = Math.max(t.y1, y);
    }
  };

  let operandes: PdfValue[] = [];
  const nb = (depuisLaFin: number): number => {
    const v = operandes[operandes.length - depuisLaFin];
    return typeof v === 'number' ? v : 0;
  };

  // Origine PDF en bas à gauche ; l'éditeur travaille en haut à gauche.
  const versHaut = (y: number) => height - y;

  const lex = new Lexer(flux, 0);
  let garde = 0;
  while (lex.i < flux.length && garde++ < 500000) {
    lex.skip();
    if (lex.i >= flux.length) break;
    const ch = flux[lex.i];

    const estDebutValeur = ch === 0x2f || ch === 0x28 || ch === 0x5b || ch === 0x3c
      || (ch >= 0x30 && ch <= 0x39) || ch === 0x2b || ch === 0x2d || ch === 0x2e;
    if (estDebutValeur) {
      const before = lex.i;
      const v = lex.value();
      if (lex.i === before) lex.i++;
      operandes.push(v);
      if (operandes.length > 40) operandes.shift();
      continue;
    }

    const op = lex.word();
    switch (op) {
      case 'q': pile.push({ ...etat, ctm: [...etat.ctm] as Mat }); break;
      case 'Q': { const e = pile.pop(); if (e) etat = e; break; }
      case 'cm': etat.ctm = mul([nb(6), nb(5), nb(4), nb(3), nb(2), nb(1)], etat.ctm); break;

      case 'rg': etat.fill = rgbHex(nb(3), nb(2), nb(1)); etat.fillSet = true; break;
      case 'g': etat.fill = rgbHex(nb(1), nb(1), nb(1)); etat.fillSet = true; break;
      case 'k': etat.fill = cmykHex(nb(4), nb(3), nb(2), nb(1)); etat.fillSet = true; break;
      case 'sc': case 'scn': {
        const vals = operandes.filter(v => typeof v === 'number') as number[];
        const n = vals.length;
        if (n >= 4) { etat.fill = cmykHex(vals[n - 4], vals[n - 3], vals[n - 2], vals[n - 1]); etat.fillSet = true; }
        else if (n === 3) { etat.fill = rgbHex(vals[0], vals[1], vals[2]); etat.fillSet = true; }
        else if (n === 1) { etat.fill = rgbHex(vals[0], vals[0], vals[0]); etat.fillSet = true; }
        break;
      }

      case 're': {
        const x = nb(4), y = nb(3), w = nb(2), h = nb(1);
        toucher(x, y); toucher(x + w, y + h);
        if (chemin.t) { chemin.t.segments += 4; chemin.t.sousTraces++; }
        sommet(x, y); sommet(x + w, y); sommet(x + w, y + h); sommet(x, y + h);
        curseur = [x, y];
        break;
      }
      case 'm':
        curseur = [nb(2), nb(1)];
        toucher(curseur[0], curseur[1]);
        if (chemin.t) { chemin.t.sousTraces++; sommet(curseur[0], curseur[1]); }
        break;
      case 'l':
        curseur = [nb(2), nb(1)];
        toucher(curseur[0], curseur[1]);
        if (chemin.t) chemin.t.segments++;
        sommet(curseur[0], curseur[1]);
        break;
      case 'c': case 'v': case 'y': {
        // Les points de contrôle bornent la courbe : la boîte est au pire un peu
        // large, jamais fausse. Assez juste pour une pastille ou une pilule.
        if (op === 'c') { toucher(nb(6), nb(5)); toucher(nb(4), nb(3)); curseur = [nb(2), nb(1)]; }
        else { toucher(nb(4), nb(3)); curseur = [nb(2), nb(1)]; }
        toucher(curseur[0], curseur[1]);
        sommet(curseur[0], curseur[1]);
        if (chemin.t) { chemin.t.segments++; chemin.t.courbes = true; }
        break;
      }
      case 'h': break;
      case 'f': case 'F': case 'f*': case 'b': case 'b*': case 'B': case 'B*': {
        const t = chemin.t;
        if (t && t.sousTraces <= 1 && compacite(t.poly, t.x1 - t.x0, t.y1 - t.y0) >= 0.55) {
          const [ax, ay] = apply(etat.ctm, t.x0, t.y0);
          const [bx, by] = apply(etat.ctm, t.x1, t.y1);
          const x = Math.min(ax, bx), w = Math.abs(bx - ax);
          const yHaut = Math.max(ay, by), h = Math.abs(by - ay);
          // Un aplat plus petit qu'un point n'est pas un aplat.
          if (w > 1.5 && h > 1.5) rects.push({ ordre: ordre++, x, y: versHaut(yHaut), w, h, color: etat.fill, arrondi: t.courbes });
        }
        chemin.t = null;
        break;
      }
      case 'n': case 'W': case 'W*': case 'S': case 's': chemin.t = null; break;

      case 'BT': enTexte = true; tm = [1, 0, 0, 1, 0, 0]; tlm = [...tm] as Mat; break;
      case 'ET': enTexte = false; break;
      case 'Tf': {
        const nom = operandes[operandes.length - 2];
        police = isName(nom) ? fonts.get(nom.name) : undefined;
        corps = nb(1) || 12;
        break;
      }
      case 'TL': interligne = nb(1); break;
      case 'Td': tlm = mul([1, 0, 0, 1, nb(2), nb(1)], tlm); tm = [...tlm] as Mat; break;
      case 'TD': interligne = -nb(1); tlm = mul([1, 0, 0, 1, nb(2), nb(1)], tlm); tm = [...tlm] as Mat; break;
      case 'Tm': tlm = [nb(6), nb(5), nb(4), nb(3), nb(2), nb(1)]; tm = [...tlm] as Mat; break;
      case 'T*': tlm = mul([1, 0, 0, 1, 0, -interligne], tlm); tm = [...tlm] as Mat; break;

      case 'Tj': case 'TJ': case "'": case '"': {
        if (op === "'" || op === '"') { tlm = mul([1, 0, 0, 1, 0, -interligne], tlm); tm = [...tlm] as Mat; }
        const arg = operandes[operandes.length - 1];
        let brut = '';
        if (typeof arg === 'string') brut = arg;
        else if (Array.isArray(arg)) for (const p of arg) if (typeof p === 'string') brut += p;
        const txt = decode(brut, police);
        if (enTexte && txt.trim()) {
          const m = mul(tm, etat.ctm);
          const [x, yBase] = apply(m, 0, 0);
          const taille = corps * echelle(m);
          texts.push({
            ordre: ordre++,
            text: txt, x, y: versHaut(yBase) - taille, size: taille,
            font: police?.name ?? 'inconnue',
            color: etat.fillSet ? etat.fill : '#000000',
            bold: !!police?.bold, italic: !!police?.italic,
          });
        }
        break;
      }

      case 'Do': {
        const nom = operandes[operandes.length - 1];
        const xo = isName(nom) ? doc.objFor(xobjects?.get(nom.name) ?? null) : undefined;
        const st = doc.resolve(xo?.dict?.get('Subtype') ?? null);
        if (isName(st) && st.name === 'Image') {
          // Le carré unité est le repère d'une image en PDF : sa boîte réelle
          // est la matrice courante appliquée à ce carré.
          const [ax, ay] = apply(etat.ctm, 0, 0);
          const [bx, by] = apply(etat.ctm, 1, 1);
          const x = Math.min(ax, bx), w = Math.abs(bx - ax);
          const yHaut = Math.max(ay, by), h = Math.abs(by - ay);
          if (w > 2 && h > 2) images.push({ ordre: ordre++, x, y: versHaut(yHaut), w, h });
        }
        break;
      }
      default: break;
    }
    if (op) operandes = [];
  }

  return { width, height, texts, rects, images };
}

/** Lit la structure d'un PDF. Rend une page par page du document. */
export function extractPdf(buf: Uint8Array, maxPages = 12): PdfPage[] {
  const doc = new PdfDoc(buf);
  return doc.pages().slice(0, maxPages).map(p => {
    try { return readPage(doc, p); }
    catch { return { width: 1080, height: 1080, texts: [], rects: [], images: [] }; }
  });
}
