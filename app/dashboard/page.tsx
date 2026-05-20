'use client';
import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';

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
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#0A0A0A', color:'#555', fontFamily:'Satoshi,sans-serif', fontSize:14 }}>
      Chargement…
    </div>
  );

  const userName = user?.email?.split('@')[0] || 'vous';

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#0A0A0A', fontFamily:'Satoshi,sans-serif' }}>
      <Sidebar />

      {/* Delete confirmation modal */}
      {/* Main content */}
      <main style={{ marginLeft:240, flex:1, padding:'48px 56px' }}>

        {/* Header */}
        <div style={{ marginBottom:40, position:'relative' }}>
          <svg width="120" height="120" viewBox="0 0 120 120" style={{ position:'absolute', top:-20, right:0, opacity:0.07, pointerEvents:'none' }}>
            <path d="M60 0L67 53L120 60L67 67L60 120L53 67L0 60L53 53Z" fill="#B8F028"/>
          </svg>
          <h1 style={{ fontFamily:'Gambetta,serif', fontSize:52, fontWeight:700, letterSpacing:'-0.03em', lineHeight:1.05, color:'#F0EFE9' }}>
            Bonjour,<br />
            <em style={{ fontStyle:'italic', color:'#B8F028' }}>{userName}</em>
          </h1>
          <p style={{ color:'#555', fontSize:15, marginTop:12 }}>Voici un aperçu de votre activité</p>
        </div>

        {/* Ticker */}
        <div style={{ overflow:'hidden', background:'#B8F028', padding:'10px 0', margin:'0 0 40px', borderRadius:8 }}>
          <div style={{ display:'flex', animation:'ticker 20s linear infinite', width:'max-content' }}>
            {['CRÉEZ','PUBLIEZ','RÉPÉTEZ','KLIP','CRÉEZ','PUBLIEZ','RÉPÉTEZ','KLIP','CRÉEZ','PUBLIEZ','RÉPÉTEZ','KLIP'].map((t,i) => (
              <span key={i} style={{ fontFamily:'Cabinet Grotesk,sans-serif', fontWeight:800, fontSize:13, letterSpacing:'0.12em', padding:'0 28px', color:'#000', whiteSpace:'nowrap' }}>{t} •</span>
            ))}
          </div>
        </div>

        {/* Metrics */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:48 }}>
          {[
            { label:'Clients actifs',      value:workspaces.length, accent:'#B8F028' },
            { label:'Posts cette semaine', value:0,                  accent:'#F0EFE9' },
            { label:'En attente',          value:0,                  accent:'#333' },
          ].map((m,i) => (
            <div key={i} style={{ background:'#111', border:'1px solid #1E1E1E', borderRadius:12, padding:28, borderTop:`2px solid ${m.accent}` }}>
              <div style={{ fontFamily:'Gambetta,serif', fontSize:52, fontWeight:700, color:'#F0EFE9', lineHeight:1 }}>{m.value}</div>
              <div style={{ fontFamily:'Cabinet Grotesk,sans-serif', fontSize:11, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'#555', marginTop:8 }}>{m.label}</div>
            </div>
          ))}
        </div>

        {/* Clients section */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <h2 style={{ fontFamily:'Cabinet Grotesk,sans-serif', fontWeight:700, fontSize:14, letterSpacing:'0.08em', textTransform:'uppercase', color:'#555' }}>Clients</h2>
          <a href="/workspace/new" style={{ background:'#B8F028', color:'#000', fontWeight:700, fontSize:13, padding:'8px 16px', borderRadius:8, textDecoration:'none', fontFamily:'Cabinet Grotesk,sans-serif' }}>
            + Nouveau client
          </a>
        </div>

        {workspaces.length === 0 ? (
          <div style={{ background:'#111', border:'1px dashed #1E1E1E', borderRadius:12, padding:64, textAlign:'center' }}>
            <p style={{ fontFamily:'Gambetta,serif', fontWeight:700, fontSize:22, letterSpacing:'-0.02em', color:'#F0EFE9', marginBottom:10 }}>Aucun client</p>
            <p style={{ color:'#555', fontSize:14, marginBottom:28 }}>Créez votre premier workspace client.</p>
            <a href="/workspace/new" style={{ background:'#B8F028', color:'#000', fontWeight:700, fontSize:14, padding:'12px 24px', borderRadius:8, textDecoration:'none', fontFamily:'Cabinet Grotesk,sans-serif' }}>
              Créer un client
            </a>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16 }}>
            {workspaces.map((w, i) => {
              const colors = ['#B8F028','#7B5CF5','#FF4D3B','#2A2A2A'];
              const color = colors[i % colors.length];
              const textColor = color === '#B8F028' ? '#000' : '#fff';
              return (
                <div
                  key={w.id}
                  style={{ background:'#111', border:'1px solid #1E1E1E', borderRadius:12, padding:24, transition:'all 0.2s', position:'relative' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor='#B8F028'; e.currentTarget.style.background='#161616'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor='#1E1E1E'; e.currentTarget.style.background='#111'; }}
                >
                  {/* Delete button */}
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (confirm(`Supprimer "${w.name}" et tous ses posts ?`)) {
                        await supabase.from('workspaces').delete().eq('id', w.id);
                        setWorkspaces(prev => prev.filter(x => x.id !== w.id));
                      }
                    }}
                    title="Supprimer ce client"
                    style={{ position:'absolute', top:12, right:12, background:'transparent', border:'1px solid #2A2A2A', color:'#444', width:28, height:28, borderRadius:6, cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor='#FF4D3B'; e.currentTarget.style.color='#FF4D3B'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor='#2A2A2A'; e.currentTarget.style.color='#444'; }}
                  >
                    ✕
                  </button>

                  {/* Avatar + name */}
                  <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
                    <div style={{ width:40, height:40, borderRadius:8, background:color, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:16, color:textColor, fontFamily:'Cabinet Grotesk,sans-serif', flexShrink:0 }}>
                      {w.name[0].toUpperCase()}
                    </div>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontFamily:'Cabinet Grotesk,sans-serif', fontWeight:700, fontSize:15, color:'#F0EFE9', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{w.name}</div>
                      <div style={{ fontSize:12, color:'#444', marginTop:2 }}>Workspace actif</div>
                    </div>
                  </div>

                  {/* CTAs */}
                  <div style={{ display:'flex', gap:8 }}>
                    <a href={`/workspace/${w.id}`} style={{ flex:1, textAlign:'center', background:'#B8F028', color:'#000', fontWeight:700, fontSize:13, padding:'9px 0', borderRadius:7, textDecoration:'none', fontFamily:'Cabinet Grotesk,sans-serif' }}>
                      Produire
                    </a>
                    <a href={`/workspace/${w.id}/planning`} style={{ flex:1, textAlign:'center', background:'transparent', border:'1px solid #2A2A2A', color:'#555', fontSize:13, padding:'9px 0', borderRadius:7, textDecoration:'none' }}>
                      Planning
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
