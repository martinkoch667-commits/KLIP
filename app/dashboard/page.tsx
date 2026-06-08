'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';

const WS_COLORS = ['#7B5CF5', '#2FD79B', '#C8732B', '#5A86E8', '#DD2A7B', '#88B394', '#E8A03A', '#4A8DD4'];

function IconCalendar() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4.5" width="18" height="16" rx="3"/><path d="M3 9h18M8 2.5v4M16 2.5v4"/></svg>;
}
function IconSend() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M22 3L11 14M22 3l-7 19-4-8-8-4 19-7Z"/></svg>;
}
function IconClients() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M16 5.2a3.2 3.2 0 0 1 0 6M17.5 19a5.5 5.5 0 0 0-2.2-4.4"/></svg>;
}
function IconSpark() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3Z"/></svg>;
}
function IconTrash() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M9 7V4.5h6V7M6 7l1 13h10l1-13"/></svg>;
}
function IconArrow() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17L17 7M8 7h9v9"/></svg>;
}
function IconPlus() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>;
}

interface StatTileProps {
  value: string | number;
  label: string;
  icon: React.ReactNode;
  tone?: 'mint' | 'warn' | 'default';
  sub?: string;
}

function StatTile({ value, label, icon, tone = 'default', sub }: StatTileProps) {
  const iconBg = tone === 'mint' ? 'var(--mint-soft)' : tone === 'warn' ? 'var(--warn-soft)' : 'var(--sunk)';
  const iconColor = tone === 'mint' ? 'var(--mint-2)' : tone === 'warn' ? 'var(--warn)' : 'var(--ink-2)';
  return (
    <div className="card tile-accent" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ width: 38, height: 38, borderRadius: 11, display: 'grid', placeItems: 'center', background: iconBg, color: iconColor }}>
          {icon}
        </span>
        {sub && <span className="chip" style={{ background: 'var(--sunk)', color: 'var(--ink-2)' }}>{sub}</span>}
      </div>
      <div>
        <div className="num" style={{ fontSize: 34, lineHeight: 1 }}>{value}</div>
        <div style={{ color: 'var(--ink-2)', fontSize: 13, marginTop: 3, fontWeight: 600 }}>{label}</div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      setUser(session.user);
      const { data } = await supabase.from('workspaces').select('*').order('created_at', { ascending: false });
      setWorkspaces(data || []);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--canvas)', color: 'var(--ink-3)', fontFamily: 'var(--sans)', fontSize: 14 }}>
      Chargement…
    </div>
  );

  const userName = user?.email?.split('@')[0] || 'vous';
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const todayCapitalized = today.charAt(0).toUpperCase() + today.slice(1);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--canvas)' }}>
      <Sidebar />
      <main style={{ marginLeft: 'var(--sb-w)', flex: 1, overflowY: 'auto' }}>
        <div className="page screen-in">

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, marginBottom: 26, flexWrap: 'wrap' }}>
            <div>
              <div className="label" style={{ marginBottom: 8 }}>{todayCapitalized}</div>
              <h1 className="h-display" style={{ fontSize: 36 }}>
                Bonjour, <span className="it" style={{ color: 'var(--mint-2)' }}>{userName}.</span>
              </h1>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <Link href="/workspace/new" className="btn btn-dark">
                <IconSpark /> Nouveau client
              </Link>
            </div>
          </div>

          {/* Stat tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 14 }}>
            <StatTile value={workspaces.length} label="Clients actifs" icon={<IconClients />} tone="mint" />
            <StatTile value={0} label="Posts publiés aujourd'hui" icon={<IconSend />} sub="Auto" />
            <StatTile value={0} label="En attente de validation" icon={<IconCalendar />} tone="warn" />
            <StatTile value={workspaces.length} label="Comptes connectés" icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="5"/>
                <circle cx="12" cy="12" r="4"/>
                <circle cx="17.3" cy="6.7" r="1" fill="currentColor" stroke="none"/>
              </svg>
            } />
          </div>

          {/* Clients grid */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, marginTop: 24 }}>
            <h2 className="h-title" style={{ fontSize: 18 }}>Vos clients</h2>
            <Link href="/workspace/new" className="btn btn-primary btn-sm">
              <IconPlus /> Ajouter un client
            </Link>
          </div>

          {workspaces.length === 0 ? (
            <div
              className="card"
              style={{ border: '1.5px dashed var(--line)', background: 'transparent', minHeight: 240, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}
            >
              <span style={{ width: 52, height: 52, borderRadius: 15, background: 'var(--sunk)', display: 'grid', placeItems: 'center', color: 'var(--ink-3)' }}>
                <IconPlus />
              </span>
              <div style={{ textAlign: 'center' }}>
                <p className="h-title" style={{ fontSize: 17, marginBottom: 6 }}>Aucun client encore</p>
                <p style={{ color: 'var(--ink-2)', fontSize: 14, marginBottom: 20 }}>Créez votre premier espace client pour démarrer.</p>
                <Link href="/workspace/new" className="btn btn-primary">
                  Créer un client
                </Link>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
              {workspaces.map((w, i) => {
                const color = WS_COLORS[i % WS_COLORS.length];
                const wsInitials = w.name.slice(0, 2).toUpperCase();
                return (
                  <div key={w.id} className="card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    {/* Color header band */}
                    <div style={{ height: 72, background: `linear-gradient(135deg, ${color}33, ${color}88)`, position: 'relative', display: 'flex', alignItems: 'flex-end', padding: 14 }}>
                      <div style={{ position: 'absolute', top: 10, right: 10 }}>
                        <button
                          onClick={async e => {
                            e.stopPropagation();
                            if (confirm(`Supprimer "${w.name}" et tous ses posts ?`)) {
                              await supabase.from('workspaces').delete().eq('id', w.id);
                              setWorkspaces(prev => prev.filter(x => x.id !== w.id));
                            }
                          }}
                          className="btn btn-ghost btn-icon"
                          style={{ color: 'var(--ink-3)', padding: 6 }}
                          title="Supprimer"
                        >
                          <IconTrash />
                        </button>
                      </div>
                    </div>

                    <div style={{ padding: '0 18px 18px' }}>
                      {/* Avatar + name */}
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 14 }}>
                        <span style={{
                          width: 48, height: 48, borderRadius: 13,
                          background: color,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 16, fontWeight: 800, color: '#fff',
                          fontFamily: 'var(--mono)',
                          boxShadow: '0 0 0 3px var(--white)',
                          marginTop: -22, flexShrink: 0,
                        }}>
                          {wsInitials}
                        </span>
                        <div style={{ paddingBottom: 2 }}>
                          <div className="h-title" style={{ fontSize: 16 }}>{w.name}</div>
                          <div style={{ fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 600 }}>Workspace actif</div>
                        </div>
                      </div>

                      {/* Stats row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingTop: 14, borderTop: '1px solid var(--line)', marginBottom: 14 }}>
                        <div><span className="num" style={{ fontSize: 18 }}>0</span> <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>planifiés</span></div>
                        <div><span className="num" style={{ fontSize: 18 }}>0</span> <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>publiés</span></div>
                      </div>

                      {/* CTAs */}
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Link href={`/workspace/${w.id}`} className="btn btn-dark btn-sm" style={{ flex: 1, justifyContent: 'center' }}>
                          Produire
                        </Link>
                        <Link href={`/workspace/${w.id}/planning`} className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: 'center' }}>
                          Planning <IconArrow />
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Add card */}
              <Link
                href="/workspace/new"
                className="card"
                style={{ border: '1.5px dashed var(--line)', background: 'transparent', minHeight: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--ink-3)', transition: 'all .15s', textDecoration: 'none' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--mint-2)'; e.currentTarget.style.color = 'var(--mint-2)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.color = 'var(--ink-3)'; }}
              >
                <span style={{ width: 46, height: 46, borderRadius: 13, background: 'var(--sunk)', display: 'grid', placeItems: 'center' }}>
                  <IconPlus />
                </span>
                <span style={{ fontWeight: 700, fontSize: 14 }}>Nouvel espace client</span>
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
