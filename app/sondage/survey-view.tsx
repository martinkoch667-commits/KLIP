'use client';

import { useState } from 'react';

type Choice = { v: string; l: string };

const ROLES: Choice[] = [
  { v: 'freelance', l: 'Community manager freelance' },
  { v: 'agence', l: 'Agence / studio' },
  { v: 'interne', l: 'En interne dans une marque' },
  { v: 'createur', l: 'Créateur·rice de contenu' },
  { v: 'autre', l: 'Autre' },
];

const CLIENTS: Choice[] = [
  { v: '0', l: 'Aucun pour l’instant' },
  { v: '1', l: '1' },
  { v: '2-3', l: '2 à 3' },
  { v: '4-8', l: '4 à 8' },
  { v: '9+', l: '9 et plus' },
];

const PAINS: Choice[] = [
  { v: 'visuels', l: 'Créer les visuels' },
  { v: 'legendes', l: 'Écrire les légendes' },
  { v: 'idees', l: 'Trouver les idées' },
  { v: 'validation', l: 'Faire valider par le client' },
  { v: 'programmation', l: 'Programmer et publier' },
  { v: 'reporting', l: 'Faire le reporting' },
  { v: 'fichiers', l: 'Retrouver les fichiers et les chartes' },
];

const BUDGETS: Choice[] = [
  { v: '<20', l: 'Moins de 20 €' },
  { v: '20-40', l: '20 à 40 €' },
  { v: '40-80', l: '40 à 80 €' },
  { v: '80+', l: 'Plus de 80 €' },
  { v: 'ne-sais-pas', l: 'Je ne sais pas encore' },
];

export default function SurveyView({ initialEmail = '' }: { initialEmail?: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [role, setRole] = useState('');
  const [clients, setClients] = useState('');
  const [pains, setPains] = useState<string[]>([]);
  const [tools, setTools] = useState('');
  const [wish, setWish] = useState('');
  const [budget, setBudget] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const togglePain = (v: string) =>
    setPains(p => (p.includes(v) ? p.filter(x => x !== v) : [...p, v]));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErr('Il me faut un email valide pour relier votre réponse à votre inscription.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/sondage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role, clients, pains, tools, wish, budget }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Erreur');
      setDone(true);
    } catch {
      setErr("L'enregistrement a échoué. Réessayez dans un instant — ou répondez-moi directement par email.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <main style={S.page}>
        <div className="card" style={{ ...S.card, textAlign: 'center' }}>
          <div style={S.badge}>Reçu 5/5</div>
          <h1 style={S.h1}>Merci, c’est noté.</h1>
          <p style={S.lead}>
            Vos réponses arrivent directement chez moi et vont peser sur ce que je code les prochaines
            semaines. Je vous écris à l’ouverture — avant tout le monde.
          </p>
          <a className="btn btn-primary" href="/acces-anticipe" style={{ marginTop: 22 }}>
            Revoir Klip
          </a>
        </div>
      </main>
    );
  }

  return (
    <main style={S.page}>
      <form className="card" style={S.card} onSubmit={submit}>
        <div style={S.badge}>2 minutes · 5 questions</div>
        <h1 style={S.h1}>Aidez-moi à construire le bon outil</h1>
        <p style={S.lead}>
          Vous faites partie des tout premiers inscrits sur Klip. Vos réponses décident très
          concrètement de ce que je développe d’ici l’ouverture.
        </p>

        <Field label="Votre email" hint="Pour relier votre réponse à votre inscription.">
          <input
            className="input"
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="vous@agence.com"
            style={S.input}
          />
        </Field>

        <Field label="1. Vous êtes plutôt…">
          <Radios name="role" options={ROLES} value={role} onChange={setRole} />
        </Field>

        <Field label="2. Combien de comptes clients gérez-vous aujourd’hui ?">
          <Radios name="clients" options={CLIENTS} value={clients} onChange={setClients} />
        </Field>

        <Field label="3. Qu’est-ce qui vous prend le plus de temps chaque semaine ?" hint="Plusieurs réponses possibles.">
          <div style={S.chips}>
            {PAINS.map(o => (
              <button
                key={o.v}
                type="button"
                onClick={() => togglePain(o.v)}
                style={{ ...S.chip, ...(pains.includes(o.v) ? S.chipOn : null) }}
              >
                {o.l}
              </button>
            ))}
          </div>
        </Field>

        <Field label="4. Quels outils utilisez-vous aujourd’hui ?" hint="Canva, Notion, Later, Meta Business Suite, un carnet…">
          <input
            className="input"
            value={tools}
            onChange={e => setTools(e.target.value)}
            placeholder="Canva + Notion + Meta Business Suite"
            style={S.input}
          />
        </Field>

        <Field label="5. Si Klip pouvait vous enlever UNE galère, laquelle ?" hint="La réponse qui m’est la plus utile. Écrivez comme ça vient.">
          <textarea
            value={wish}
            onChange={e => setWish(e.target.value)}
            rows={4}
            placeholder="Les allers-retours de validation avec les clients me tuent…"
            style={{ ...S.input, resize: 'vertical', lineHeight: 1.6, padding: '12px 14px' }}
          />
        </Field>

        <Field label="Bonus — combien vous semblerait juste, par mois ?" hint="Optionnel, et sans engagement évidemment.">
          <Radios name="budget" options={BUDGETS} value={budget} onChange={setBudget} />
        </Field>

        {err && <p style={S.err}>{err}</p>}

        <button className="btn btn-primary" type="submit" disabled={busy} style={{ marginTop: 8, width: '100%' }}>
          {busy ? 'Envoi…' : 'Envoyer mes réponses'}
        </button>
        <p style={{ ...S.hint, textAlign: 'center', marginTop: 12 }}>
          Vos réponses ne servent qu’à construire Klip. Rien n’est revendu, rien n’est partagé.
        </p>
      </form>
    </main>
  );
}

/* ── Sous-composants ──────────────────────────────────────────────────────── */

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 26 }}>
      <div style={S.label}>{label}</div>
      {hint && <div style={S.hint}>{hint}</div>}
      <div style={{ marginTop: 10 }}>{children}</div>
    </div>
  );
}

function Radios({
  name, options, value, onChange,
}: { name: string; options: Choice[]; value: string; onChange: (v: string) => void }) {
  return (
    <div style={S.chips}>
      {options.map(o => (
        <button
          key={o.v}
          type="button"
          aria-pressed={value === o.v}
          onClick={() => onChange(value === o.v ? '' : o.v)}
          style={{ ...S.chip, ...(value === o.v ? S.chipOn : null) }}
          data-name={name}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

/* ── Styles (tokens du design system, jamais de couleur en dur) ───────────── */

const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: 'var(--canvas)',
    padding: '48px 18px 72px',
    fontFamily: 'var(--sans)',
    color: 'var(--ink)',
  },
  card: { maxWidth: 620, margin: '0 auto', padding: '34px 30px 30px' },
  badge: {
    display: 'inline-block',
    background: 'var(--leaf)',
    color: 'var(--leaf-ink)',
    fontSize: 12,
    fontWeight: 700,
    padding: '5px 11px',
    borderRadius: 999,
    marginBottom: 16,
  },
  h1: {
    margin: '0 0 10px',
    fontFamily: 'var(--display)',
    fontSize: 30,
    lineHeight: 1.12,
    letterSpacing: '-.03em',
    fontWeight: 800,
  },
  lead: { margin: 0, fontSize: 15.5, lineHeight: 1.62, color: 'var(--ink-2)' },
  label: { fontSize: 15, fontWeight: 700, letterSpacing: '-.01em' },
  hint: { marginTop: 4, fontSize: 13, lineHeight: 1.5, color: 'var(--ink-3)' },
  input: { width: '100%', fontFamily: 'inherit', fontSize: 15 },
  chips: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  chip: {
    fontFamily: 'inherit',
    fontSize: 13.5,
    fontWeight: 600,
    padding: '9px 14px',
    borderRadius: 999,
    border: '1px solid var(--line)',
    background: 'var(--paper)',
    color: 'var(--ink-2)',
    cursor: 'pointer',
    transition: 'background .15s, color .15s, border-color .15s',
  },
  chipOn: { background: 'var(--leaf)', color: 'var(--leaf-ink)', borderColor: 'transparent' },
  err: {
    marginTop: 20,
    marginBottom: 0,
    fontSize: 13.5,
    lineHeight: 1.5,
    color: 'var(--leaf-ink)',
    background: 'var(--sunk)',
    borderRadius: 'var(--r-s)',
    padding: '11px 13px',
  },
};
