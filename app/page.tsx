'use client';
import { useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';

export default function LandingPage() {
  const supabase = createClientComponentClient();
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.push('/dashboard');
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ background: '#080808', color: '#F0EFE9', fontFamily: 'Satoshi, sans-serif', minHeight: '100vh' }}>

      <style>{`
        @keyframes ticker {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>

      {/* NAV */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, padding: '20px 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #111', background: 'rgba(8,8,8,0.8)', backdropFilter: 'blur(12px)' }}>
        <span style={{ fontFamily: 'Cabinet Grotesk, sans-serif', fontWeight: 900, fontSize: 22, letterSpacing: '-0.04em' }}>
          Kl<span style={{ color: '#B8F028' }}>ip</span>
        </span>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <a href="/login" style={{ color: '#666', textDecoration: 'none', fontSize: 14 }}>Se connecter</a>
          <a href="/register" style={{ background: '#B8F028', color: '#000', fontWeight: 700, padding: '10px 20px', borderRadius: 8, textDecoration: 'none', fontSize: 14, fontFamily: 'Cabinet Grotesk, sans-serif' }}>
            Essayer gratuitement →
          </a>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '120px 48px 80px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <svg width="200" height="200" viewBox="0 0 200 200" style={{ position: 'absolute', top: 80, right: '10%', opacity: 0.06 }}>
          <path d="M100 0L110 90L200 100L110 110L100 200L90 110L0 100L90 90Z" fill="#B8F028"/>
        </svg>
        <svg width="120" height="120" viewBox="0 0 120 120" style={{ position: 'absolute', bottom: '15%', left: '8%', opacity: 0.04 }}>
          <path d="M60 0L67 53L120 60L67 67L60 120L53 67L0 60L53 53Z" fill="#B8F028"/>
        </svg>

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#111', border: '1px solid #222', borderRadius: 20, padding: '6px 14px', marginBottom: 40, fontSize: 13, color: '#666' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#B8F028', display: 'inline-block' }} />
          Conçu pour les agences créatives françaises
        </div>

        <h1 style={{ fontFamily: 'Gambetta, serif', fontSize: 'clamp(48px, 8vw, 96px)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.0, marginBottom: 32, maxWidth: 900 }}>
          Créez. Publiez.<br />
          <em style={{ fontStyle: 'italic', color: '#B8F028' }}>Répétez.</em>
        </h1>

        <p style={{ fontSize: 18, color: '#666', maxWidth: 560, lineHeight: 1.7, marginBottom: 48 }}>
          Klip automatise la production de contenu Instagram pour les agences. Upload tes photos, génère les visuels et les descriptions, programme tout en un clic.
        </p>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          <a href="/register" style={{ background: '#B8F028', color: '#000', fontWeight: 700, padding: '16px 32px', borderRadius: 10, textDecoration: 'none', fontSize: 16, fontFamily: 'Cabinet Grotesk, sans-serif' }}>
            Commencer gratuitement →
          </a>
          <a href="#comment" style={{ background: 'transparent', color: '#F0EFE9', border: '1px solid #222', padding: '16px 32px', borderRadius: 10, textDecoration: 'none', fontSize: 16 }}>
            Voir comment ça marche
          </a>
        </div>

        <p style={{ color: '#333', fontSize: 13, marginTop: 24 }}>Pas de carte bancaire requise · 14 jours gratuits</p>
      </section>

      {/* TICKER */}
      <div style={{ overflow: 'hidden', background: '#B8F028', padding: '12px 0' }}>
        <div style={{ display: 'flex', animation: 'ticker 25s linear infinite', width: 'max-content' }}>
          {['CRÉEZ', 'PUBLIEZ', 'RÉPÉTEZ', 'GAGNEZ DU TEMPS', 'KLIP', 'AGENCES', 'SOCIAL MEDIA', 'IA', 'CRÉEZ', 'PUBLIEZ', 'RÉPÉTEZ', 'GAGNEZ DU TEMPS', 'KLIP', 'AGENCES', 'SOCIAL MEDIA', 'IA'].map((t, i) => (
            <span key={i} style={{ fontFamily: 'Cabinet Grotesk, sans-serif', fontWeight: 800, fontSize: 13, letterSpacing: '0.12em', padding: '0 32px', color: '#000', whiteSpace: 'nowrap' }}>{t} •</span>
          ))}
        </div>
      </div>

      {/* PROBLEME */}
      <section style={{ padding: '120px 48px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>
          <div>
            <p style={{ fontFamily: 'Cabinet Grotesk, sans-serif', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#444', marginBottom: 20 }}>Le problème</p>
            <h2 style={{ fontFamily: 'Gambetta, serif', fontSize: 48, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 24 }}>
              2h par client.<br />Chaque semaine.<br />
              <em style={{ color: '#B8F028', fontStyle: 'italic' }}>Ça suffit.</em>
            </h2>
            <p style={{ color: '#666', fontSize: 16, lineHeight: 1.8 }}>
              Canva pour les visuels. ChatGPT pour les descriptions. Metricool pour programmer. Trois outils, des heures perdues, des allers-retours sans fin avec les clients.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { time: '45min', label: 'Édition des visuels sur Canva' },
              { time: '30min', label: 'Génération des descriptions sur ChatGPT' },
              { time: '45min', label: 'Programmation sur Metricool ou Meta' },
            ].map((item, i) => (
              <div key={i} style={{ background: '#111', border: '1px solid #1E1E1E', borderRadius: 12, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 20 }}>
                <span style={{ fontFamily: 'Gambetta, serif', fontSize: 36, fontWeight: 700, color: '#333', minWidth: 80 }}>{item.time}</span>
                <span style={{ color: '#666', fontSize: 15 }}>{item.label}</span>
              </div>
            ))}
            <div style={{ background: '#B8F028', borderRadius: 12, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 20 }}>
              <span style={{ fontFamily: 'Gambetta, serif', fontSize: 36, fontWeight: 700, color: '#000', minWidth: 80 }}>2h+</span>
              <span style={{ color: '#000', fontWeight: 700, fontSize: 15 }}>perdu par client, chaque semaine</span>
            </div>
          </div>
        </div>
      </section>

      {/* SOLUTION */}
      <section id="comment" style={{ padding: '120px 48px', background: '#0D0D0D', borderTop: '1px solid #111', borderBottom: '1px solid #111' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <p style={{ fontFamily: 'Cabinet Grotesk, sans-serif', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#444', marginBottom: 20, textAlign: 'center' }}>La solution</p>
          <h2 style={{ fontFamily: 'Gambetta, serif', fontSize: 56, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.05, textAlign: 'center', marginBottom: 80 }}>
            Tout en un.<br /><em style={{ color: '#B8F028', fontStyle: 'italic' }}>En 20 minutes.</em>
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
            {[
              { num: '01', title: 'Upload tes photos', desc: "Tu reviens du tournage. Tu glisses tes photos dans Klip. C'est tout." },
              { num: '02', title: "L'IA génère tout", desc: "Texte sur le visuel, description Instagram, hashtags. Calibrés à l'identité de ta marque." },
              { num: '03', title: 'Programme en un clic', desc: 'Tu choisis les jours. Klip publie automatiquement sur Instagram et Facebook.' },
            ].map((step, i) => (
              <div key={i} style={{ background: '#111', border: '1px solid #1E1E1E', borderRadius: 16, padding: 32 }}>
                <div style={{ fontFamily: 'Gambetta, serif', fontSize: 64, fontWeight: 700, color: '#1E1E1E', lineHeight: 1, marginBottom: 24 }}>{step.num}</div>
                <h3 style={{ fontFamily: 'Cabinet Grotesk, sans-serif', fontWeight: 700, fontSize: 20, marginBottom: 12 }}>{step.title}</h3>
                <p style={{ color: '#666', fontSize: 15, lineHeight: 1.7 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section style={{ padding: '120px 48px', maxWidth: 1100, margin: '0 auto' }}>
        <h2 style={{ fontFamily: 'Gambetta, serif', fontSize: 56, fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 80, textAlign: 'center' }}>
          Tout ce dont<br /><em style={{ color: '#B8F028', fontStyle: 'italic' }}>ton agence a besoin</em>
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          {[
            { icon: '✦', title: 'Génération IA', desc: "Textes visuels et descriptions générés automatiquement à partir de tes photos et du contexte de la marque." },
            { icon: '🎨', title: 'Éditeur visuel', desc: 'Applique la charte graphique de chaque client. Modifie le texte, les couleurs, la position.' },
            { icon: '📅', title: 'Calendrier éditorial', desc: 'Visualise et planifie tous tes posts. Drag & drop pour changer les dates.' },
            { icon: '📱', title: 'Multi-clients', desc: 'Un workspace par client. Charte graphique, voix de marque, historique — tout séparé et organisé.' },
            { icon: '🤖', title: 'Voix de marque IA', desc: "Configure le ton, le style, les mots interdits. Chaque génération respecte l'ADN de la marque." },
            { icon: '⚡', title: 'Publication directe', desc: 'Connexion Instagram et Facebook. Publie ou programme sans quitter Klip.' },
          ].map((f, i) => (
            <div key={i} style={{ background: '#111', border: '1px solid #1E1E1E', borderRadius: 12, padding: 28, display: 'flex', gap: 20, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 28, flexShrink: 0 }}>{f.icon}</span>
              <div>
                <h3 style={{ fontFamily: 'Cabinet Grotesk, sans-serif', fontWeight: 700, fontSize: 17, marginBottom: 8 }}>{f.title}</h3>
                <p style={{ color: '#666', fontSize: 14, lineHeight: 1.7 }}>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section style={{ padding: '120px 48px', background: '#0D0D0D', borderTop: '1px solid #111' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'Gambetta, serif', fontSize: 56, fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 16 }}>
            Simple.<br /><em style={{ color: '#B8F028', fontStyle: 'italic' }}>Transparent.</em>
          </h2>
          <p style={{ color: '#666', fontSize: 17, marginBottom: 64 }}>Un seul plan. Tout inclus.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, maxWidth: 700, margin: '0 auto' }}>
            {[
              { plan: 'Solo', price: '29€', period: '/mois', features: ["Jusqu'à 3 clients", 'Génération IA illimitée', 'Éditeur visuel', 'Calendrier éditorial'], cta: 'Commencer', accent: false },
              { plan: 'Agence', price: '79€', period: '/mois', features: ['Clients illimités', 'Génération IA illimitée', 'Publication Instagram & Facebook', 'Support prioritaire'], cta: 'Commencer', accent: true },
            ].map((p, i) => (
              <div key={i} style={{ background: p.accent ? '#B8F028' : '#111', border: `1px solid ${p.accent ? '#B8F028' : '#1E1E1E'}`, borderRadius: 16, padding: 32, textAlign: 'left' }}>
                <div style={{ fontFamily: 'Cabinet Grotesk, sans-serif', fontWeight: 700, fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase', color: p.accent ? '#000' : '#555', marginBottom: 16 }}>{p.plan}</div>
                <div style={{ fontFamily: 'Gambetta, serif', fontSize: 52, fontWeight: 700, color: p.accent ? '#000' : '#F0EFE9', letterSpacing: '-0.03em', lineHeight: 1 }}>
                  {p.price}<span style={{ fontSize: 18, fontFamily: 'Satoshi, sans-serif', fontWeight: 400 }}>{p.period}</span>
                </div>
                <div style={{ margin: '24px 0', borderTop: `1px solid ${p.accent ? 'rgba(0,0,0,0.1)' : '#1E1E1E'}` }} />
                {p.features.map((f, j) => (
                  <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, color: p.accent ? '#000' : '#888', fontSize: 14 }}>
                    <span style={{ color: p.accent ? '#000' : '#B8F028' }}>✓</span> {f}
                  </div>
                ))}
                <a href="/register" style={{ display: 'block', marginTop: 24, background: p.accent ? '#000' : '#B8F028', color: p.accent ? '#B8F028' : '#000', fontWeight: 700, padding: '12px 24px', borderRadius: 8, textDecoration: 'none', textAlign: 'center', fontFamily: 'Cabinet Grotesk, sans-serif', fontSize: 14 }}>
                  {p.cta} →
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section style={{ padding: '120px 48px', textAlign: 'center' }}>
        <h2 style={{ fontFamily: 'Gambetta, serif', fontSize: 72, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.0, marginBottom: 40 }}>
          Prêt à gagner<br /><em style={{ color: '#B8F028', fontStyle: 'italic' }}>10h par semaine ?</em>
        </h2>
        <a href="/register" style={{ background: '#B8F028', color: '#000', fontWeight: 700, padding: '18px 40px', borderRadius: 12, textDecoration: 'none', fontSize: 18, fontFamily: 'Cabinet Grotesk, sans-serif', display: 'inline-block' }}>
          Essayer Klip gratuitement →
        </a>
        <p style={{ color: '#333', fontSize: 14, marginTop: 20 }}>Pas de carte bancaire · Annulation à tout moment</p>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid #111', padding: '40px 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'Cabinet Grotesk, sans-serif', fontWeight: 900, fontSize: 18, letterSpacing: '-0.04em' }}>
          Kl<span style={{ color: '#B8F028' }}>ip</span>
        </span>
        <div style={{ display: 'flex', gap: 24, color: '#444', fontSize: 13 }}>
          <a href="/login" style={{ color: '#444', textDecoration: 'none' }}>Connexion</a>
          <a href="/register" style={{ color: '#444', textDecoration: 'none' }}>S&apos;inscrire</a>
          <span>© 2026 Klip</span>
        </div>
      </footer>

    </div>
  );
}
