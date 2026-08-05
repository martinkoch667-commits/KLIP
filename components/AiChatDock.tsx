'use client';

// ─── Assistant conversationnel (montage ET éditeur visuel) ───────────────────
// Pastille en bas à droite. L'utilisateur décrit ce qu'il veut ; la réponse de
// l'IA arrive avec une liste d'actions que `applyActions` exécute sur le
// document. Chaque tour renvoie l'ÉTAT COURANT au serveur : l'IA voit donc le
// résultat de ce qu'elle a déjà fait et peut enchaîner les retouches.
// Les modifications passent par les setters normaux → annulables (Cmd+Z).
//
// Le composant est agnostique : `endpoint` décide de l'assistant appelé
// (/api/montage-chat ou /api/editor-chat) et `buildProject` de ce qu'il voit.

import { useEffect, useRef, useState } from 'react';
import VoiceButton from '@/components/VoiceButton';

export interface ChatAction { type: string; [k: string]: unknown }

export interface ChatMsg {
  role: 'user' | 'assistant';
  text: string;
  actions?: number; // nombre d'actions appliquées, mention discrète sous la bulle
}

export interface ChatLabels {
  title: string;
  intro: string;
  placeholder: string;
  thinking: string;
  error: string;
  open: string;
  close: string;
}

// Marque de l'assistant — die-cut, comme les stickers de la DA (contour blanc
// via paintOrder, aplats de la charte) plutôt qu'un pictogramme au trait fin.
// Une bulle violette, les yeux Klip dedans : ça dit « on lui parle » et
// « il regarde ta création » d'un seul coup d'œil, et ça reste lisible à 20px.
const AssistantMark = ({ size = 22, blink = true }: { size?: number; blink?: boolean }) => {
  const outline = { stroke: '#fff', strokeWidth: 9, strokeLinejoin: 'round' as const, paintOrder: 'stroke' as const };
  return (
    <svg width={size} height={size} viewBox="-6 -6 112 112" overflow="visible" aria-hidden="true">
      {/* Bulle + queue en une seule forme : la découpe reste franche à petite taille. */}
      <path d="M22 8h56a16 16 0 0 1 16 16v38a16 16 0 0 1-16 16H50l-22 16 4-16h-10A16 16 0 0 1 6 62V24A16 16 0 0 1 22 8Z"
        fill="#BDF2A0" {...outline} />
      <g className={blink ? 'stk-eyes-pupils' : undefined} style={{ transformOrigin: '50px 43px' }}>
        <ellipse cx="38" cy="43" rx="8.5" ry="11" fill="#6656D9" />
        <ellipse cx="64" cy="43" rx="8.5" ry="11" fill="#6656D9" />
      </g>
      {/* Éclat : le signal « IA », repris du sticker sparkle (pointes nettes).
          Il reste leaf même si les yeux sont violets : il déborde sur le fond du
          bouton, qui est violet — en violet il n'y resterait que le contour. */}
      <path d="M88 2c3 14 8 19 22 22-14 3-19 8-22 22-3-14-8-19-22-22 14-3 19-8 22-22Z"
        fill="#6656D9" stroke="#fff" strokeWidth="7" strokeLinejoin="miter" strokeMiterlimit={14} paintOrder="stroke" />
    </svg>
  );
};

// Flèche d'envoi : trait épais, même famille que les boutons pleins de l'app.
const SendArrow = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 19V5" />
    <path d="m5.5 11.5 6.5-6.5 6.5 6.5" />
  </svg>
);

const Sparkle = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3l1.5 5L19 9.5 13.5 11 12 16l-1.5-5L5 9.5 10.5 8 12 3Z" />
    <path d="M18 15l.7 2.3L21 18l-2.3.7L18 21l-.7-2.3L15 18l2.3-.7L18 15Z" />
  </svg>
);

// Révèle un texte caractère par caractère (même effet que l'écran d'attente IA).
function useTypedText(text: string, active: boolean, speed = 12) {
  const [n, setN] = useState(active ? 0 : text.length);
  useEffect(() => { setN(active ? 0 : text.length); }, [text, active]);
  useEffect(() => {
    if (!active || n >= text.length) return;
    const t = setTimeout(() => setN((c) => Math.min(text.length, c + (text.length > 90 ? 3 : 1))), speed);
    return () => clearTimeout(t);
  }, [n, text, active, speed]);
  return text.slice(0, n);
}

function Bubble({ m, live }: { m: ChatMsg; live: boolean }) {
  const shown = useTypedText(m.text, live && m.role === 'assistant');
  return (
    <div className={'mzchat-msg is-' + m.role}>
      {m.role === 'assistant' && <span className="mzchat-avatar"><AssistantMark size={22} /></span>}
      <div className="mzchat-msg-col">
        <div className="mzchat-bubble">{m.role === 'assistant' ? shown : m.text}</div>
        {m.role === 'assistant' && !!m.actions && (
          <div className="mzchat-applied"><Sparkle size={11} /> {m.actions}</div>
        )}
      </div>
    </div>
  );
}

export default function AiChatDock({
  endpoint,
  labels,
  buildProject,
  applyActions,
  disabled,
}: {
  endpoint: string;
  labels: ChatLabels;
  // Peut être asynchrone : l'assistant visuel récupère la charte et les posts
  // déjà validés du client avant d'envoyer, et rend le canvas en image.
  buildProject: () => unknown | Promise<unknown>;
  applyActions: (actions: ChatAction[]) => number | Promise<number>;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  // Sortie animée : on rejoue l'aller-retour de l'ouverture avant de démonter,
  // sinon le panneau disparaît d'un coup et « l'ouverture » semble à sens unique.
  const [closing, setClosing] = useState(false);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, busy, open]);
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  function requestClose() {
    setClosing(true);
    window.setTimeout(() => { setClosing(false); setOpen(false); }, 170);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') requestClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  async function send() {
    const instruction = draft.trim();
    if (!instruction || busy) return;
    setDraft('');
    const history = msgs.map((m) => ({ role: m.role, text: m.text }));
    setMsgs((p) => [...p, { role: 'user', text: instruction }]);
    setBusy(true);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project: await buildProject(), history, instruction }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        setMsgs((p) => [...p, { role: 'assistant', text: data?.error || labels.error }]);
        return;
      }
      // On applique AVANT d'afficher la réponse : le « c'est fait » ne s'écrit
      // que si les actions ont réellement été exécutées.
      const applied = Array.isArray(data.actions) && data.actions.length ? await applyActions(data.actions) : 0;
      setMsgs((p) => [...p, { role: 'assistant', text: String(data.reply || ''), actions: applied }]);
    } catch {
      setMsgs((p) => [...p, { role: 'assistant', text: labels.error }]);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button className="mzchat-fab" onClick={() => setOpen(true)} title={labels.open} aria-label={labels.open}>
        <span className="mzchat-fab-mark"><AssistantMark size={26} /></span>
        <span className="mzchat-fab-lbl">{labels.title}</span>
      </button>
    );
  }

  return (
    <div className={'mzchat' + (closing ? ' is-closing' : '')} role="dialog" aria-label={labels.title}>
      <div className="mzchat-head">
        <span className="mzchat-head-mark"><AssistantMark size={24} /></span>
        <strong className="mzchat-title">{labels.title}</strong>
        <button className="mzchat-x" onClick={requestClose} title={labels.close} aria-label={labels.close}>×</button>
      </div>

      <div className="mzchat-list" ref={listRef}>
        {msgs.length === 0 && <p className="mzchat-intro">{labels.intro}</p>}
        {msgs.map((m, i) => <Bubble key={i} m={m} live={i === msgs.length - 1 && !busy} />)}
        {busy && (
          <div className="mzchat-msg is-assistant">
            <span className="mzchat-avatar"><AssistantMark size={22} /></span>
            <div className="mzchat-msg-col">
              <div className="mzchat-bubble mzchat-typing">
                {labels.thinking}<span className="aithink-caret" aria-hidden />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mzchat-input" data-voice-scope>
        <textarea
          ref={inputRef}
          value={draft}
          rows={1}
          placeholder={labels.placeholder}
          disabled={disabled || busy}
          onChange={(e) => setDraft(e.target.value)}
          // Les raccourcis clavier de l'éditeur (Suppr, S, espace…) ne doivent pas
          // se déclencher pendant la saisie.
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); }
            e.stopPropagation();
          }}
        />
        {/* Même dictée que le reste de l'app (VoiceButton) : continue tant qu'on
            n'a pas cliqué Terminer, se relance seule après les coupures Chrome. */}
        <VoiceButton value={draft} onChange={setDraft} compact />
        <button className="mzchat-send" onClick={() => void send()} disabled={disabled || busy || !draft.trim()} title={labels.title} aria-label={labels.title}>
          <SendArrow size={17} />
        </button>
      </div>
    </div>
  );
}
