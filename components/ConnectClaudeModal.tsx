'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Fiche from '@/components/Fiche';

/* Modale « Connecter à Claude » : trois étapes pour ajouter KLIP comme
   connecteur MCP personnalisé. Le flux OAuth se déclenche côté Claude à
   l'étape 3, il n'y a rien à faire côté KLIP.

   Elle ne s'ouvre plus toute seule à la création du compte. Une fenêtre qui
   surgit au premier écran, avant même d'avoir un client, demande de brancher
   un outil tiers à quelqu'un qui n'a encore rien produit : elle se referme
   sans être lue. Le point d'entrée est Réglages, quand on la cherche.

   Le logo Claude est le vrai (public/claude-logo.svg, récupéré chez
   Anthropic), et non plus une vignette passée par le service de favicons de
   Google, qui rendait une image floue et pouvait disparaître du jour au
   lendemain. */

const rich = { strong: (c: React.ReactNode) => <strong>{c}</strong> };

function ClaudeMark({ size = 30 }: { size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/claude-logo.svg" alt="Claude" width={size} height={size} style={{ display: 'block' }} />;
}

export function ConnectClaudeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations('landing.claude');
  const [copied, setCopied] = useState(false);
  /* <Fiche> rend dans <body> par un portail. C'est indispensable ici : la
     landing enveloppe la page dans un conteneur transformé (défilement fluide
     GSAP), et un `position: fixed` posé dedans est relatif à ce conteneur —
     son z-index reste prisonnier de ce contexte d'empilement. Le bandeau
     défilant passait par-dessus la modale, quel que soit le z-index. */

  const mcpUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/mcp` : 'https://getklip.fr/api/mcp';

  function copyUrl() {
    navigator.clipboard.writeText(mcpUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Fiche open={open} onClose={onClose} label={t('title')} zIndex={9000} className="fiche-w" closeButton>
        {/* Les deux marques côte à côte disent en une image ce que la fiche
            explique ensuite en trois étapes. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-192.png" alt="KLIP" width={34} height={34} style={{ borderRadius: 9, display: 'block' }} />
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-3)' }}>+</span>
          <span style={{ width: 34, height: 34, borderRadius: 9, background: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0, boxShadow: '0 0 0 1px var(--line-2)' }}>
            <ClaudeMark size={22} />
          </span>
        </div>
        <h2 className="fiche-title">{t('title')}</h2>
        <p className="fiche-lede">{t('lead')}</p>

        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            <Step n={1} title={t('s1Title')}>
              <p style={pText}>{t.rich('s1Text', rich)}</p>
              <a href="https://claude.ai/settings/connectors" target="_blank" rel="noopener noreferrer" style={linkBtn}>
                {t('s1Link')} <span style={{ fontSize: 12 }}>↗</span>
              </a>
            </Step>

            <Step n={2} title={t('s2Title')}>
              <p style={pText}>{t.rich('s2Text', rich)}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--sunk, #F1F2F5)', border: '1px solid var(--line, rgba(13,15,10,.10))', borderRadius: 'var(--r-s, 9px)', padding: '9px 12px' }}>
                <code style={{ flex: 1, fontSize: 12.5, fontFamily: 'var(--mono)', color: 'var(--ink, #14160F)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mcpUrl}</code>
                <button onClick={copyUrl}
                  style={{ flexShrink: 0, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12.5, fontWeight: 800, color: 'var(--mint-2, #21B381)', fontFamily: 'var(--sans)' }}>
                  {copied ? t('copied') : t('copy')}
                </button>
              </div>
            </Step>

            <Step n={3} title={t('s3Title')}>
              <p style={{ ...pText, margin: 0 }}>{t.rich('s3Text', rich)}</p>
            </Step>
          </div>

          <div className="fiche-foot" style={{ marginTop: 26 }}>
            <button onClick={onClose} className="fiche-go">{t('close')}</button>
          </div>
        </div>
    </Fiche>
  );
}

const pText: React.CSSProperties = { fontSize: 13.5, lineHeight: 1.6, color: 'var(--ink-2, #5A5E50)', margin: '0 0 10px' };
const linkBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700,
  color: 'var(--ink, #14160F)', textDecoration: 'none',
  border: '1.5px solid var(--line, rgba(13,15,10,.10))', borderRadius: 'var(--r-s, 9px)', padding: '8px 12px',
};

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 14 }}>
      <span style={{ flexShrink: 0, width: 26, height: 26, borderRadius: '50%', background: 'var(--leaf, #BDF2A0)', color: 'var(--leaf-ink, #1E3317)', display: 'grid', placeItems: 'center', fontFamily: 'var(--display)', fontWeight: 800, fontSize: 12.5 }}>{n}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 14.5, color: 'var(--ink, #14160F)', marginBottom: 5, fontFamily: 'var(--display)' }}>{title}</div>
        {children}
      </div>
    </div>
  );
}

/* Déclencheur de la landing : une ligne d'intégration discrète, pas un
   troisième bouton d'appel. */
export function ConnectClaudePill() {
  const t = useTranslations('landing.claude');
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="claude-tie" aria-label={t('title')}>
        <span className="claude-tie-glyph lp-logo" aria-hidden="true" style={{ background: '#fff', display: 'grid', placeItems: 'center' }}>
          <ClaudeMark size={18} />
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
