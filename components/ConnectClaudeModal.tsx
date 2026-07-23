'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

// balise <strong> des textes riches i18n
const rich = { strong: (c: React.ReactNode) => <strong>{c}</strong> };

// Modale "Connecter à Claude" (façon Vibiz) — 3 étapes pour ajouter KLIP comme
// connecteur MCP personnalisé dans Claude. Le flux OAuth se déclenche
// automatiquement côté Claude à l'étape 3 (aucune action manuelle côté KLIP).
export function ConnectClaudeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations('landing.claude');
  const [copied, setCopied] = useState(false);
  if (!open) return null;

  const mcpUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/mcp` : 'https://getklip.fr/api/mcp';

  function copyUrl() {
    navigator.clipboard.writeText(mcpUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('title')}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(6,20,14,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 460, width: '100%', maxHeight: '86vh', overflowY: 'auto', background: '#fff', borderRadius: 20, padding: '28px 26px', boxShadow: '0 30px 70px -20px rgba(0,0,0,.4)' }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--mono)', fontSize: 10.5, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--mint-2, #1F7A4D)', background: 'var(--mint-soft, #E4F8EF)', padding: '5px 10px', borderRadius: 99, marginBottom: 16 }}>
          ✳ KLIP · Claude · MCP
        </span>
        <h2 style={{ fontFamily: 'var(--display)', fontSize: 22, fontWeight: 800, margin: '0 0 6px', color: '#0C2A1D' }}>{t('title')}</h2>
        <p style={{ fontSize: 13.5, color: 'rgba(12,14,10,.6)', margin: '0 0 24px', lineHeight: 1.5 }}>
          {t('lead')}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Step n={1} title={t('s1Title')}>
            <p style={pText}>{t.rich('s1Text', rich)}</p>
            <a href="https://claude.ai/settings/connectors" target="_blank" rel="noopener noreferrer" style={linkBtn}>
              {t('s1Link')} <span style={{ fontSize: 12 }}>↗</span>
            </a>
          </Step>

          <Step n={2} title={t('s2Title')}>
            <p style={pText}>{t.rich('s2Text', rich)}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F6F3EA', border: '1px solid rgba(12,14,10,.1)', borderRadius: 10, padding: '9px 12px' }}>
              <code style={{ flex: 1, fontSize: 12.5, fontFamily: 'var(--mono)', color: '#14160F', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mcpUrl}</code>
              <button onClick={copyUrl} style={{ flexShrink: 0, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--mint-2, #1F7A4D)', fontFamily: 'var(--sans)' }}>
                {copied ? t('copied') : t('copy')}
              </button>
            </div>
          </Step>

          <Step n={3} title={t('s3Title')}>
            <p style={pText}>{t.rich('s3Text', rich)}</p>
          </Step>
        </div>

        <button onClick={onClose} style={{ marginTop: 26, width: '100%', padding: '12px', borderRadius: 12, border: '1.5px solid rgba(12,14,10,.15)', background: 'transparent', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', fontFamily: 'var(--sans)', color: '#0C2A1D' }}>
          {t('close')}
        </button>
      </div>
    </div>
  );
}

const pText: React.CSSProperties = { fontSize: 13, lineHeight: 1.5, color: 'rgba(12,14,10,.68)', margin: '0 0 10px' };
const linkBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: '#0C2A1D', textDecoration: 'none', border: '1.5px solid rgba(12,14,10,.15)', borderRadius: 10, padding: '8px 12px' };

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 14 }}>
      <span style={{ flexShrink: 0, width: 26, height: 26, borderRadius: '50%', background: '#0C2A1D', color: '#2FD79B', display: 'grid', placeItems: 'center', fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 12.5 }}>{n}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: '#0C2A1D', marginBottom: 4, fontFamily: 'var(--display)' }}>{title}</div>
        {children}
      </div>
    </div>
  );
}

// Déclencheur landing : ligne « intégration » discrète (pas un 3e CTA).
// Communique « KLIP fonctionne aussi avec Claude » — clic ouvre la modale.
export function ConnectClaudePill() {
  const t = useTranslations('landing.claude');
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="claude-tie" aria-label={t('title')}>
        <span className="claude-tie-glyph lp-logo" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="https://www.google.com/s2/favicons?sz=128&domain=claude.ai" alt="" width={26} height={26} />
        </span>
        <span className="claude-tie-txt">
          {t.rich('pill', rich)}
        </span>
        <span className="claude-tie-arr" aria-hidden="true">→</span>
      </button>
      <ConnectClaudeModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
