"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";

interface WsCard {
  id: string;
  name: string;
  primary_color: string | null;
  logo_url: string | null;
  draftCount: number;
}

const WS_COLORS = ["#7B5CF5","#2FD79B","#C8732B","#5A86E8","#DD2A7B","#88B394","#E8A03A","#4A8DD4"];
const TONE_KEYS = ['toneChic', 'toneEngaged', 'toneFun', 'tonePro', 'tonePoetic', 'toneDirect'] as const;

function IcSpark() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3Z"/></svg>;
}
function IcUpload() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>;
}
function IcCheck() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>;
}

function BatchSteps() {
  const t = useTranslations('composer');
  const steps = [[t('stepImport'), true, false], [t('stepGenerate'), false, false], [t('stepRefine'), false, false]];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
      {steps.map(([label, active], i) => (
        <div key={String(label)} style={{ display: 'flex', alignItems: 'center', gap: 9, flex: i < 2 ? undefined : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{
              width: 26, height: 26, borderRadius: '50%', display: 'grid', placeItems: 'center',
              fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 12,
              background: active ? 'var(--ink)' : 'var(--sunk)',
              color: active ? 'var(--paper)' : 'var(--ink-3)',
            }}>{i + 1}</span>
            <span style={{ fontWeight: 700, fontSize: 13.5, color: active ? 'var(--ink)' : 'var(--ink-3)' }}>{String(label)}</span>
          </div>
          {i < 2 && <div style={{ flex: 1, height: 2, borderRadius: 2, background: 'var(--line)', maxWidth: 80, minWidth: 24 }} />}
        </div>
      ))}
    </div>
  );
}

export default function ComposerPage() {
  const t = useTranslations('composer');
  const supabase = createClientComponentClient();
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<WsCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tone, setTone] = useState<typeof TONE_KEYS[number]>('toneChic');

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }

      const { data: ws } = await supabase
        .from("workspaces")
        .select("id, name, primary_color, logo_url")
        .order("created_at");

      if (!ws) { setLoading(false); return; }

      const cards: WsCard[] = await Promise.all(
        ws.map(async (w) => {
          const { count } = await supabase
            .from("posts")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", w.id)
            .in("status", ["idle", "generated"]);
          return { ...w, draftCount: count ?? 0 };
        })
      );

      setWorkspaces(cards);
      if (cards.length > 0) setSelectedId(cards[0].id);
      setLoading(false);
    })();
  }, [supabase, router]);

  function handleCompose() {
    if (selectedId) router.push(`/workspace/${selectedId}`);
  }

  return (
    <div className="app">
      <Sidebar />
      <div className="work">
        <div className="topbar">
          <h1 style={{ fontSize: 14, fontWeight: 800, margin: 0 }}>{t('title')}</h1>
          <div style={{ marginLeft: "auto" }}>
            <Link href="/workspace/new" className="btn btn-sm btn-ghost">+ {t('newClient')}</Link>
          </div>
        </div>

        <div className="scroll">
          <div className="page screen-in" style={{ maxWidth: 1180 }}>
            {/* Hero header */}
            <div style={{
              position: 'relative', borderRadius: 24, overflow: 'hidden',
              padding: '28px 30px', marginBottom: 26,
              background: 'var(--forest)', color: 'var(--cream)',
            }}>
              <div style={{ position: 'absolute', width: 280, height: 280, borderRadius: '50%', right: -60, top: -120, background: 'radial-gradient(circle, var(--mint), transparent 70%)', opacity: .5, filter: 'blur(20px)' }} />
              <div style={{ position: 'absolute', width: 200, height: 200, borderRadius: '50%', right: 160, bottom: -140, background: 'radial-gradient(circle, var(--acid), transparent 70%)', opacity: .35, filter: 'blur(20px)' }} />
              <div style={{ position: 'relative', zIndex: 2 }}>
                <div className="label" style={{ color: 'var(--mint)', marginBottom: 10 }}>{t('heroLabel')}</div>
                <h1 className="h-display" style={{ fontSize: 38, color: 'var(--cream)', maxWidth: 600 }}>
                  {t('heroTitlePre')} <span className="it" style={{ color: 'var(--mint)' }}>{t('heroTitleAccent')}</span>
                </h1>
                <p style={{ color: 'var(--cream-2)', marginTop: 10, maxWidth: 520, fontSize: 15 }}>
                  {t('heroSubtitle')}
                </p>
              </div>
            </div>

            <BatchSteps />

            {loading ? (
              <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>{t('loading')}</div>
            ) : workspaces.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '80px 20px', gap: 20 }}>
                <div style={{ width: 76, height: 76, borderRadius: 22, background: 'var(--sunk)', display: 'grid', placeItems: 'center', color: 'var(--ink-3)' }}>
                  <IcUpload />
                </div>
                <div>
                  <h2 className="h-display" style={{ fontSize: 24, marginBottom: 8 }}>{t('emptyTitle')}</h2>
                  <p style={{ fontSize: 14, color: 'var(--ink-3)', maxWidth: 340, lineHeight: 1.6, margin: '0 auto' }}>
                    {t('emptyText')}
                  </p>
                </div>
                <Link href="/workspace/new" className="btn btn-primary" style={{ textDecoration: 'none' }}>+ {t('newClient')}</Link>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 18, alignItems: 'start' }} className="batch-import">
                {/* Dropzone */}
                <div className="card" style={{ padding: 22 }}>
                  <button
                    onClick={handleCompose}
                    style={{
                      width: '100%', border: '1.5px dashed var(--line)', borderRadius: 16,
                      padding: '48px 20px', background: 'var(--canvas)', cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
                      transition: 'all .15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--mint-2)'; e.currentTarget.style.background = 'var(--mint-soft)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.background = 'var(--canvas)'; }}
                  >
                    <span style={{ width: 56, height: 56, borderRadius: 15, background: 'var(--ink)', color: 'var(--paper)', display: 'grid', placeItems: 'center' }}>
                      <IcUpload />
                    </span>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>{t('openEditor')}</div>
                      <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 2 }}>
                        {selectedId ? t('composeFor', { name: workspaces.find(w => w.id === selectedId)?.name ?? '' }) : t('selectClientHint')}
                      </div>
                    </div>
                  </button>
                </div>

                {/* Right panel */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 0 }}>
                  {/* Client picker */}
                  <div className="card" style={{ padding: 18 }}>
                    <div className="label" style={{ marginBottom: 10 }}>{t('clientLabel')}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {workspaces.map((ws, i) => {
                        const color = ws.primary_color || WS_COLORS[i % WS_COLORS.length];
                        const initials = ws.name.slice(0, 2).toUpperCase();
                        const isSelected = selectedId === ws.id;
                        return (
                          <button key={ws.id} onClick={() => setSelectedId(ws.id)} style={{
                            display: 'flex', alignItems: 'center', gap: 10, padding: 8,
                            borderRadius: 9, textAlign: 'left', background: isSelected ? 'var(--mint-soft)' : 'transparent',
                            border: 'none', cursor: 'pointer', transition: 'background .14s',
                          }}>
                            <span style={{ width: 28, height: 28, borderRadius: 8, background: color, display: 'grid', placeItems: 'center', fontSize: 9, fontWeight: 800, color: '#fff', fontFamily: 'var(--mono)', flexShrink: 0 }}>
                              {initials}
                            </span>
                            <span style={{ fontWeight: 700, fontSize: 13.5, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ws.name}</span>
                            {isSelected && <span style={{ color: 'var(--mint-2)' }}><IcCheck /></span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Tone selector */}
                  <div className="card" style={{ padding: 18 }}>
                    <div className="label" style={{ marginBottom: 10 }}>{t('toneLabel')}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
                      {TONE_KEYS.map(k => (
                        <button key={k} onClick={() => setTone(k)} style={{
                          padding: 9, borderRadius: 9, fontWeight: 700, fontSize: 13, transition: 'all .14s', border: 'none', cursor: 'pointer',
                          background: tone === k ? 'var(--ink)' : 'var(--white)',
                          color: tone === k ? 'var(--paper)' : 'var(--ink-2)',
                          boxShadow: tone === k ? 'none' : 'inset 0 0 0 1px var(--line)',
                        }}>{t(k)}</button>
                      ))}
                    </div>
                  </div>

                  <button
                    className="btn btn-primary"
                    style={{ width: '100%', padding: '13px', fontSize: 14.5, opacity: selectedId ? 1 : .45, pointerEvents: selectedId ? 'auto' : 'none' }}
                    onClick={handleCompose}
                  >
                    <IcSpark /> {t('composeButton')}
                  </button>
                </div>
              </div>
            )}

            <style>{`@media(max-width:900px){.batch-import{grid-template-columns:1fr !important;}}`}</style>
          </div>
        </div>
      </div>
    </div>
  );
}
