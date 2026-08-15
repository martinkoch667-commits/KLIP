"use client";
// ─── Édition de texte en surimpression du canvas ──────────────────────────────
//
// Remplace le <textarea> d'origine, qui avait deux défauts :
//
//  • il ne savait afficher qu'UNE typographie pour tout le bloc, et la déduisait
//    mal (fontStyle « 500 » ou « italic 700 » retombait sur du 400 non italique,
//    d'où le changement d'aspect au double-clic) ;
//  • il forçait le texte en minuscules quand le calque était en capitales, ce
//    qui écrasait la casse d'origine à chaque frappe.
//
// Ici, un contentEditable rend un <span> par fragment stylé, avec exactement la
// même typographie que Konva, et les capitales sont un simple text-transform.
// Sélectionner une portion et changer la police n'affecte que cette portion.

import React, { useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import {
  RUN_KEYS, blockStyleOf, konvaFontFamily, cssItalic, cssWeight, measureBlock,
  normalizeRuns, runCss, applyRunPatch,
  type BlockStyle, type ResolvedStyle, type RunKey, type TextLike, type TextRun,
} from '@/lib/richText';

export interface RichTextHandle {
  /** Applique un style à la portion sélectionnée. false si rien n'est sélectionné. */
  applyToSelection: (patch: Partial<Record<RunKey, unknown>>) => boolean;
  getRange: () => { start: number; end: number } | null;
  focus: () => void;
}

interface Props {
  el: TextLike & { id: string; x: number; y: number; rotation?: number };
  /** Zones d'interface (barre d'outils…) qui ne doivent pas fermer l'édition. */
  keepOpenSelector?: string;
  onChange: (patch: { text?: string; runs?: TextRun[] }) => void;
  onCommit: () => void;
  onExit: () => void;
  onRangeChange?: (range: { start: number; end: number } | null) => void;
}

// ─── Sérialisation DOM ↔ (texte, runs) ────────────────────────────────────────

const STYLE_ATTR = 'data-run-style';
const FILLER_ATTR = 'data-filler';

function propsOfEl(node: Node | null): Partial<Record<RunKey, unknown>> {
  let cur: Node | null = node;
  while (cur) {
    if (cur.nodeType === 1) {
      const raw = (cur as HTMLElement).getAttribute?.(STYLE_ATTR);
      if (raw) {
        try { return JSON.parse(raw) as Partial<Record<RunKey, unknown>>; } catch { return {}; }
      }
    }
    cur = cur.parentNode;
  }
  return {};
}

function sameProps(a: Partial<Record<RunKey, unknown>>, b: Partial<Record<RunKey, unknown>>) {
  for (const k of RUN_KEYS) if (a[k] !== b[k]) return false;
  return true;
}

function hasProps(p: Partial<Record<RunKey, unknown>>) {
  for (const k of RUN_KEYS) if (p[k] !== undefined) return true;
  return false;
}

const BLOCKISH = new Set(['DIV', 'P', 'LI', 'BLOCKQUOTE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6']);

/** Relit le contenu édité et le retraduit en { texte brut, runs }. */
function readDom(root: HTMLElement): { text: string; runs: TextRun[] } {
  let text = '';
  const runs: TextRun[] = [];
  const push = (chunk: string, props: Partial<Record<RunKey, unknown>>) => {
    if (!chunk) return;
    const start = text.length;
    text += chunk;
    if (!hasProps(props)) return;
    const last = runs[runs.length - 1];
    if (last && last.end === start && sameProps(propsOnly(last), props)) last.end = text.length;
    else runs.push({ start, end: text.length, ...props } as TextRun);
  };
  const propsOnly = (r: TextRun) => {
    const o: Partial<Record<RunKey, unknown>> = {};
    for (const k of RUN_KEYS) {
      const v = (r as unknown as Record<string, unknown>)[k];
      if (v !== undefined) o[k] = v;
    }
    return o;
  };

  const walk = (node: Node, isRootChild: boolean, index: number) => {
    if (node.nodeType === 3) { push(node.nodeValue ?? '', propsOfEl(node.parentNode)); return; }
    if (node.nodeType !== 1) return;
    const elNode = node as HTMLElement;
    if (elNode.tagName === 'BR') {
      if (elNode.getAttribute(FILLER_ATTR)) return;   // <br> technique de fin de bloc
      push('\n', propsOfEl(elNode.parentNode));
      return;
    }
    // Un <div>/<p> créé par le navigateur (touche Entrée) vaut un saut de ligne.
    if (BLOCKISH.has(elNode.tagName) && !(isRootChild && index === 0) && text.length > 0 && !text.endsWith('\n')) {
      push('\n', propsOfEl(elNode));
    }
    const kids = Array.from(elNode.childNodes);
    kids.forEach((k, i) => walk(k, false, i));
  };

  Array.from(root.childNodes).forEach((n, i) => walk(n, true, i));
  return { text, runs };
}

/** Reconstruit le contenu à partir de l'état. */
function writeDom(root: HTMLElement, text: string, runs: TextRun[] | undefined, base: BlockStyle) {
  const norm = normalizeRuns(runs, text.length);
  root.textContent = '';
  const cuts: number[] = [0];
  for (const r of norm) { cuts.push(r.start, r.end); }
  cuts.push(text.length);
  const uniq = Array.from(new Set(cuts)).sort((a, b) => a - b);
  for (let i = 0; i < uniq.length - 1; i++) {
    const s = uniq[i], e = uniq[i + 1];
    if (e <= s) continue;
    const run = norm.find(r => r.start <= s && e <= r.end) ?? null;
    const span = document.createElement('span');
    if (run) {
      const props: Partial<Record<RunKey, unknown>> = {};
      for (const k of RUN_KEYS) {
        const v = (run as unknown as Record<string, unknown>)[k];
        if (v !== undefined) props[k] = v;
      }
      span.setAttribute(STYLE_ATTR, JSON.stringify(props));
      Object.assign(span.style, runCss({ ...base, ...props } as ResolvedStyle) as Record<string, string>);
    }
    span.appendChild(document.createTextNode(text.slice(s, e)));
    root.appendChild(span);
  }
  // white-space: pre-wrap n'affiche pas une dernière ligne vide sans nœud après
  // le \n final : on ajoute un <br> technique, ignoré à la relecture.
  if (text.length === 0 || text.endsWith('\n')) {
    const br = document.createElement('br');
    br.setAttribute(FILLER_ATTR, '1');
    root.appendChild(br);
  }
}

// ─── Position du curseur ↔ index caractère ────────────────────────────────────

function walkNodes(root: HTMLElement): Node[] {
  const out: Node[] = [];
  const rec = (n: Node) => {
    for (const c of Array.from(n.childNodes)) {
      if (c.nodeType === 3) out.push(c);
      else if (c.nodeType === 1) {
        const e = c as HTMLElement;
        if (e.tagName === 'BR') { if (!e.getAttribute(FILLER_ATTR)) out.push(c); }
        else rec(c);
      }
    }
  };
  rec(root);
  return out;
}

// Index caractère correspondant à une position DOM. Le conteneur peut être un
// nœud texte comme un élément (le navigateur place volontiers le curseur « entre
// deux <span> ») : on mesure donc le contenu réellement situé avant la position,
// plutôt que de chercher le nœud dans une liste — c'est ce raccourci qui
// renvoyait la fin du texte dès que le curseur tombait sur une frontière.
function offsetOf(root: HTMLElement, node: Node, offset: number): number {
  try {
    const r = document.createRange();
    r.setStart(root, 0);
    r.setEnd(node, offset);
    return textLenOf(r.cloneContents());
  } catch {
    return 0;
  }
}

function textLenOf(n: Node): number {
  if (n.nodeType === 3) return n.nodeValue?.length ?? 0;
  if (n.nodeType === 1) {
    const e = n as HTMLElement;
    if (e.tagName === 'BR') return e.getAttribute(FILLER_ATTR) ? 0 : 1;
  }
  return Array.from(n.childNodes).reduce((t, c) => t + textLenOf(c), 0);
}

function locate(root: HTMLElement, index: number): { node: Node; offset: number } {
  let remaining = Math.max(0, index);
  const nodes = walkNodes(root);
  let last: { node: Node; offset: number } = { node: root, offset: 0 };
  for (const n of nodes) {
    const len = n.nodeType === 3 ? (n.nodeValue?.length ?? 0) : 1;
    if (remaining <= len) {
      if (n.nodeType === 3) return { node: n, offset: remaining };
      const parent = n.parentNode!;
      const pos = Array.from(parent.childNodes).indexOf(n as ChildNode);
      return { node: parent, offset: remaining === 0 ? pos : pos + 1 };
    }
    remaining -= len;
    if (n.nodeType === 3) last = { node: n, offset: n.nodeValue?.length ?? 0 };
  }
  return last;
}

// ─── Composant ────────────────────────────────────────────────────────────────

const RichTextOverlay = React.forwardRef<RichTextHandle, Props>(function RichTextOverlay(
  { el, keepOpenSelector, onChange, onCommit, onExit, onRangeChange }, ref,
) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const rangeRef = useRef<{ start: number; end: number } | null>(null);
  const restoreRef = useRef<{ start: number; end: number } | null>(null);
  // Ce que l'on vient d'émettre soi-même : sert à ne PAS reconstruire le DOM
  // (et donc ne pas perdre le curseur) à chaque frappe.
  const mineRef = useRef<string>('');
  // Safari/Firefox ne donnent pas toujours le focus à un <button> au clic : le
  // `relatedTarget` du blur est alors vide et on croirait à tort que l'on quitte
  // l'édition. On retient donc où le pointeur est descendu.
  const downInKeepZoneRef = useRef(false);
  const onChangeRef = useRef(onChange); onChangeRef.current = onChange;
  const onRangeRef = useRef(onRangeChange); onRangeRef.current = onRangeChange;

  const base = blockStyleOf(el);
  const baseKey = JSON.stringify(base);
  const text = el.text ?? '';
  const runsKey = JSON.stringify(normalizeRuns(el.runs, text.length));

  const setDomRange = useCallback((start: number, end: number) => {
    const root = rootRef.current;
    if (!root) return;
    const sel = window.getSelection();
    if (!sel) return;
    try {
      const a = locate(root, start);
      const b = locate(root, end);
      const r = document.createRange();
      r.setStart(a.node, a.offset);
      r.setEnd(b.node, b.offset);
      sel.removeAllRanges();
      sel.addRange(r);
    } catch { /* le DOM a bougé sous nos pieds : on laisse le curseur là où il est */ }
  }, []);

  // (Re)construction du DOM quand l'état vient de l'extérieur — pas de nos frappes.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const signature = `${text} ${runsKey} ${baseKey}`;
    if (signature === mineRef.current) return;
    mineRef.current = signature;
    writeDom(root, text, el.runs, base);
    const restore = restoreRef.current ?? rangeRef.current;
    if (restore) {
      root.focus({ preventScroll: true });
      setDomRange(restore.start, restore.end);
      restoreRef.current = null;
    }
  }, [text, runsKey, baseKey, el.runs, base, setDomRange]);

  // Focus initial : curseur en fin de texte.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    root.focus({ preventScroll: true });
    setDomRange(text.length, text.length);
    rangeRef.current = { start: text.length, end: text.length };
    // au montage uniquement
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!keepOpenSelector) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      downInKeepZoneRef.current = !!t?.closest?.(keepOpenSelector);
    };
    document.addEventListener('mousedown', onDown, true);
    return () => document.removeEventListener('mousedown', onDown, true);
  }, [keepOpenSelector]);

  // Suivi de la sélection : c'est elle qui décide si un réglage de la barre
  // d'outils s'applique à une portion ou à tout le bloc.
  useEffect(() => {
    const onSelChange = () => {
      const root = rootRef.current;
      if (!root) return;
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const r = sel.getRangeAt(0);
      if (!root.contains(r.startContainer) || !root.contains(r.endContainer)) return;
      const start = offsetOf(root, r.startContainer, r.startOffset);
      const end = offsetOf(root, r.endContainer, r.endOffset);
      const next = { start: Math.min(start, end), end: Math.max(start, end) };
      const prev = rangeRef.current;
      if (prev && prev.start === next.start && prev.end === next.end) return;
      rangeRef.current = next;
      onRangeRef.current?.(next);
    };
    document.addEventListener('selectionchange', onSelChange);
    return () => {
      document.removeEventListener('selectionchange', onSelChange);
      onRangeRef.current?.(null);
    };
  }, []);

  const emit = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const { text: t, runs } = readDom(root);
    const norm = normalizeRuns(runs, t.length);
    // On marque cet état comme « le nôtre » pour que l'effet de synchro ne
    // rebâtisse pas le DOM sous le curseur.
    mineRef.current = `${t} ${JSON.stringify(norm)} ${baseKey}`;
    onChangeRef.current({ text: t, runs: norm });
  }, [baseKey]);

  useImperativeHandle(ref, (): RichTextHandle => ({
    getRange: () => rangeRef.current,
    focus: () => rootRef.current?.focus({ preventScroll: true }),
    applyToSelection: patch => {
      const root = rootRef.current;
      const r = rangeRef.current;
      if (!root || !r || r.end <= r.start) return false;
      const { text: t, runs } = readDom(root);
      const next = applyRunPatch(runs, t.length, r.start, r.end, patch);
      restoreRef.current = { start: r.start, end: r.end };
      // Volontairement PAS de mineRef ici : on veut que le DOM soit rebâti avec
      // les nouveaux styles, puis la sélection restaurée.
      onChangeRef.current({ text: t, runs: next });
      return true;
    },
  }), []);

  // Géométrie : même moteur que le canvas, pour que la boîte d'édition tombe
  // pile sur le bloc dessiné et grandisse avec le texte.
  const metrics = measureBlock(el);

  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    left: el.x,
    top: el.y,
    width: metrics.blockW,
    minHeight: metrics.blockH,
    height: 'auto',
    padding: `${metrics.pV}px ${metrics.pH}px`,
    boxSizing: 'border-box',
    fontFamily: konvaFontFamily(base.fontFamily),
    fontSize: base.fontSize,
    fontWeight: cssWeight(base.fontStyle),
    fontStyle: cssItalic(base.fontStyle),
    color: base.fill,
    textDecoration: base.textDecoration || 'none',
    letterSpacing: base.letterSpacing ? `${base.letterSpacing}px` : 'normal',
    lineHeight: String(base.lineHeight),
    textAlign: base.align as React.CSSProperties['textAlign'],
    textTransform: base.uppercase ? 'uppercase' : 'none',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'break-word',
    // Le fond reste peint par le Rect Konva dessous ; la bordure passe en
    // box-shadow pour ne pas décaler le contenu de 2px.
    background: 'transparent',
    border: 'none',
    boxShadow: '0 0 0 2px var(--leaf)',
    outline: 'none',
    resize: 'none',
    zIndex: 100,
    pointerEvents: 'auto',
    transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
    transformOrigin: '0 0',
    cursor: 'text',
  };

  return (
    <div
      ref={rootRef}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      role="textbox"
      aria-multiline="true"
      style={containerStyle}
      onInput={emit}
      onPaste={e => {
        // Collage en texte brut : le style du calque reste maître.
        e.preventDefault();
        const plain = e.clipboardData.getData('text/plain');
        if (!plain) return;
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;
        const r = sel.getRangeAt(0);
        r.deleteContents();
        const node = document.createTextNode(plain);
        r.insertNode(node);
        r.setStartAfter(node);
        r.collapse(true);
        sel.removeAllRanges();
        sel.addRange(r);
        emit();
      }}
      onKeyDown={e => {
        if (e.key === 'Escape') { e.preventDefault(); onCommit(); onExit(); return; }
        // Konva n'a pas de notion de paragraphe : Entrée insère un vrai \n.
        if (e.key === 'Enter') {
          e.preventDefault();
          const sel = window.getSelection();
          if (!sel || sel.rangeCount === 0) return;
          const r = sel.getRangeAt(0);
          r.deleteContents();
          const node = document.createTextNode('\n');
          r.insertNode(node);
          r.setStartAfter(node);
          r.collapse(true);
          sel.removeAllRanges();
          sel.addRange(r);
          emit();
        }
      }}
      onBlur={e => {
        // Cliquer dans la barre d'outils ne doit pas sortir du mode édition :
        // sans ça, choisir une police pour une portion sélectionnée fermait
        // l'éditeur avant même d'avoir appliqué le style.
        const next = (e.relatedTarget as HTMLElement | null) ?? (document.activeElement as HTMLElement | null);
        const keep = downInKeepZoneRef.current || !!(keepOpenSelector && next?.closest?.(keepOpenSelector));
        if (keep) {
          // Le curseur revient dans le texte une fois le réglage appliqué — sauf
          // si l'utilisateur est en train de saisir une valeur (champ de taille,
          // sélecteur de graisse), où lui reprendre le focus l'empêcherait de taper.
          setTimeout(() => {
            const ae = document.activeElement as HTMLElement | null;
            if (ae && (/^(INPUT|SELECT|TEXTAREA)$/.test(ae.tagName) || (ae.isContentEditable && ae !== rootRef.current))) return;
            const root = rootRef.current;
            if (!root) return;
            root.focus({ preventScroll: true });
            const r = rangeRef.current;
            if (r) setDomRange(r.start, r.end);
          }, 0);
          return;
        }
        onCommit();
        onExit();
      }}
    />
  );
});

export default RichTextOverlay;
