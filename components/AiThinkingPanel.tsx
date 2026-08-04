'use client';

// ─── Écran d'attente IA « on voit l'IA travailler » ──────────────────────────
// Deux niveaux d'information, tous les deux RÉELS (aucun texte décoratif) :
//  • `steps`   : les grandes étapes du traitement, avec celle en cours
//  • `lines`   : le journal fin, alimenté au fil de l'exécution, révélé à la
//                machine à écrire — c'est ce qui donne l'impression de suivre
//                le raisonnement plutôt que de fixer un écran figé.
// Utilisé par le montage (thème sombre `.a-root`) ET l'éditeur visuel (thème
// clair) : les couleurs viennent des tokens, donc le composant suit le thème.

import { useEffect, useRef, useState } from 'react';

export interface AiThinkingStep {
  id: string;
  label: string;
}

// Révèle les lignes une par une, caractère par caractère. Les lignes déjà
// écrites restent affichées ; seule la dernière est en cours de frappe.
function useRevealedLines(lines: string[], speed = 14): { shown: string[]; typing: boolean } {
  const [nDone, setNDone] = useState(0);
  const [nChars, setNChars] = useState(0);

  // Le journal a été vidé (nouvelle exécution) → on repart de zéro.
  useEffect(() => {
    if (nDone > lines.length) { setNDone(0); setNChars(0); }
  }, [lines.length, nDone]);

  useEffect(() => {
    if (nDone >= lines.length) return;
    const target = lines[nDone] ?? '';
    if (nChars >= target.length) {
      const t = setTimeout(() => { setNDone((d) => d + 1); setNChars(0); }, 170);
      return () => clearTimeout(t);
    }
    // On écrit par petits paquets : plus fluide et plus rapide qu'un caractère
    // par tick sur les lignes longues, sans perdre l'effet de frappe.
    const step = target.length > 60 ? 3 : 1;
    const t = setTimeout(() => setNChars((c) => Math.min(target.length, c + step)), speed);
    return () => clearTimeout(t);
  }, [lines, nDone, nChars, speed]);

  const shown = lines.slice(0, nDone);
  const typing = nDone < lines.length;
  if (typing) shown.push((lines[nDone] ?? '').slice(0, nChars));
  return { shown, typing };
}

// Journal seul, sans l'habillage : permet de greffer « ce que l'IA est en train de
// faire » dans un écran d'attente qui a déjà sa propre identité visuelle
// (l'éditeur visuel garde son animation de marque).
export function AiThinkingLog({ lines }: { lines: string[] }) {
  const { shown, typing } = useRevealedLines(lines);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [shown.length, shown[shown.length - 1]]);
  if (!shown.length) return null;
  return (
    <div className="aithink-log" ref={ref}>
      {shown.map((l, i) => (
        <div key={i} className={'aithink-line' + (i === shown.length - 1 ? ' is-last' : '')}>
          {l}
          {i === shown.length - 1 && typing && <span className="aithink-caret" aria-hidden />}
        </div>
      ))}
    </div>
  );
}

export default function AiThinkingPanel({
  title,
  subtitle,
  steps = [],
  activeStep = -1,
  lines = [],
  progress,
}: {
  title: string;
  subtitle?: string;
  steps?: AiThinkingStep[];
  activeStep?: number;
  lines?: string[];
  progress?: number; // 0-1 — barre de progression réelle si connue
}) {
  const { shown, typing } = useRevealedLines(lines);
  const logRef = useRef<HTMLDivElement>(null);

  // Le journal suit toujours la dernière ligne écrite.
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [shown.length, shown[shown.length - 1]]);

  return (
    <div className="aithink" role="status" aria-live="polite">
      <div className="aithink-card">
        <div className="aithink-head">
          <span className="aithink-orb" aria-hidden />
          <div style={{ minWidth: 0 }}>
            <div className="aithink-title">{title}</div>
            {subtitle && <div className="aithink-sub">{subtitle}</div>}
          </div>
        </div>

        {steps.length > 0 && (
          <ul className="aithink-steps">
            {steps.map((s, i) => {
              const state = activeStep < 0 || i < activeStep ? 'done' : i === activeStep ? 'now' : 'todo';
              return (
                <li key={s.id} className={`aithink-step is-${state}`}>
                  <span className="aithink-bullet" aria-hidden>
                    {state === 'done' ? '✓' : state === 'now' ? '' : '·'}
                  </span>
                  <span className="aithink-step-lbl">{s.label}</span>
                </li>
              );
            })}
          </ul>
        )}

        {shown.length > 0 && (
          <div className="aithink-log" ref={logRef}>
            {shown.map((l, i) => (
              <div key={i} className={'aithink-line' + (i === shown.length - 1 ? ' is-last' : '')}>
                {l}
                {i === shown.length - 1 && typing && <span className="aithink-caret" aria-hidden />}
              </div>
            ))}
          </div>
        )}

        {typeof progress === 'number' && (
          <div className="aithink-bar" aria-hidden>
            <span style={{ width: `${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%` }} />
          </div>
        )}
      </div>
    </div>
  );
}
