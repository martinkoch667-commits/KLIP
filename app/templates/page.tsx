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
  // Renseigné par le seul retour OAuth Meta : c'est la preuve d'une vraie liaison.
  instagram_account_id: string | null;
  instagram_username: string | null;
  banner_url: string | null;
  logo_url: string | null;
  templateCount: number;
}

const WS_COLORS = ["#7B5CF5","#2FD79B","#C8732B","#5A86E8","#DD2A7B","#88B394","#E8A03A","#4A8DD4"];

function deriveSwatches(primary: string): string[] {
  return [primary, '#EEEDE3', '#14160F', '#8B8E7F', primary + 'aa'];
}

function ClientKitCard({ ws, color, index }: { ws: WsCard; color: string; index: number }) {
  const t = useTranslations('templatesTop');
  const initials = ws.name.slice(0, 2).toUpperCase();
  const swatches = deriveSwatches(color).slice(0, 5);
  const placeholders = [
    `linear-gradient(150deg, ${color}cc, ${color}44)`,
    `linear-gradient(150deg, ${color}88, #14160F)`,
    `linear-gradient(150deg, #EEEDE3, ${color}66)`,
  ];

  return (
    <Link href={`/workspace/${ws.id}/templates`} style={{ textDecoration: 'none' }}>
      <div
        className="card"
        style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', cursor: 'pointer', transition: 'transform .14s, box-shadow .14s' }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-pop)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = ''; }}
      >
        {/* brand band — bannière du client si définie, sinon couleur de charte */}
        <div style={{ height: 80, background: color, backgroundImage: ws.banner_url ? `url(${ws.banner_url})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center', position: 'relative' }} />
        <div style={{ padding: '0 18px 18px' }}>
          {/* avatar overlap + name */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 14 }}>
            <div style={{
              width: 46, height: 46, borderRadius: 13, background: ws.logo_url ? '#fff' : color,
              display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 800,
              color: '#fff', fontFamily: 'var(--mono)', flexShrink: 0, overflow: 'hidden',
              marginTop: -22, boxShadow: '0 0 0 3px var(--white)',
            }}>
              {ws.logo_url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={ws.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 4 }} />
                : initials}
            </div>
            <div style={{ paddingBottom: 2, minWidth: 0, flex: 1 }}>
              <div className="h-title trunc" style={{ fontSize: 16 }}>{ws.name}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}>
                {/* « Connecté » ne se déduit pas d'un pseudo saisi à la main. */}
                {ws.instagram_account_id ? `@${ws.instagram_username ?? 'Instagram'}` : t('notConnected')}
              </div>
            </div>
            <span className="chip" style={{ background: 'var(--sunk)', color: 'var(--ink-2)', fontSize: 10.5, flexShrink: 0 }}>
              {t('modelsCount', { count: ws.templateCount })}
            </span>
          </div>

          {/* palette */}
          <div className="label" style={{ marginBottom: 7, fontSize: 10 }}>{t('palette')}</div>
          <div style={{ display: 'flex', gap: 5, marginBottom: 14 }}>
            {swatches.map((c, i) => (
              <span key={i} style={{ width: 24, height: 24, borderRadius: 6, background: c, boxShadow: 'inset 0 0 0 1px rgba(13,15,10,.12)' }} />
            ))}
          </div>

          {/* template thumbnails */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14 }}>
            {placeholders.map((grad, i) => (
              <div key={i} style={{ borderRadius: 9, overflow: 'hidden', boxShadow: 'inset 0 0 0 1px var(--line)', aspectRatio: '4/5', background: grad }} />
            ))}
          </div>

          <button
            className="btn btn-ghost btn-sm"
            style={{ width: '100%' }}
            onClick={e => { e.preventDefault(); window.location.href = `/workspace/${ws.id}/templates`; }}
          >
            {t('openKit')}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17L17 7M7 7h10v10"/></svg>
          </button>
        </div>
      </div>
    </Link>
  );
}

export default function TemplatesPage() {
  const t = useTranslations('templatesTop');
  const supabase = createClientComponentClient();
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<WsCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }

      const COLONNES = "id, name, primary_color, instagram_account_id, instagram_username, logo_url";

      // `banner_url` vient d'une migration : si elle n'est pas passée sur cette
      // base, demander la colonne fait échouer TOUTE la requête, et la page
      // annonçait alors « Aucun client » à quelqu'un qui en a dix. On retente
      // donc sans elle, et on ne se tait jamais sur une erreur.
      let { data: ws, error } = await supabase
        .from("workspaces")
        .select(`${COLONNES}, banner_url`)
        .order("created_at");

      if (error) {
        const repli = await supabase.from("workspaces").select(COLONNES).order("created_at");
        ws = repli.data?.map(w => ({ ...w, banner_url: null })) ?? null;
        error = repli.error;
      }

      if (error) {
        console.error("[templates] chargement des clients", error);
        setErreur(error.message);
        setLoading(false);
        return;
      }
      if (!ws) { setLoading(false); return; }

      const cards: WsCard[] = await Promise.all(
        ws.map(async (w) => {
          const { count } = await supabase
            .from("post_templates")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", w.id);
          return { ...w, templateCount: count ?? 0 };
        })
      );

      setWorkspaces(cards);
      setLoading(false);
    })();
  }, [supabase, router]);

  return (
    <div className="app">
      <Sidebar />
      <div className="work">
        <div className="topbar" style={{ justifyContent: "space-between" }}>
          <h1 style={{ fontSize: 14, fontWeight: 800, margin: 0 }}>{t('title')}</h1>
          <Link href="/workspace/new" className="btn btn-primary btn-sm" style={{ textDecoration: "none" }}>
            + {t('newClient')}
          </Link>
        </div>

        <div className="scroll">
          <div className="page screen-in" style={{ maxWidth: 1320 }}>
            {/* Page header */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, marginBottom: 28, flexWrap: 'wrap' }}>
              <div>
                <div className="label" style={{ marginBottom: 8 }}>{t('kitsAndModelsCount', { count: workspaces.length })}</div>
                <h1 className="h-display" style={{ fontSize: 33 }}>
                  {t('titlePre')} <span className="acc-hl">{t('titleAccent')}</span>
                </h1>
                <p style={{ color: 'var(--ink-2)', marginTop: 7, maxWidth: 520 }}>
                  {t('subtitle')}
                </p>
              </div>
            </div>

            {loading ? (
              <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>{t('loading')}</div>
            ) : erreur ? (
              <div className="card" style={{ padding: 28, textAlign: "center", maxWidth: 460, margin: "40px auto" }}>
                <h2 className="h-title" style={{ fontSize: 17, marginBottom: 6 }}>{t('loadFailedTitle')}</h2>
                <p style={{ fontSize: 13.5, color: "var(--ink-2)", marginBottom: 14 }}>{t('loadFailedHint')}</p>
                <button className="btn btn-primary btn-sm" onClick={() => window.location.reload()}>{t('retry')}</button>
              </div>
            ) : workspaces.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '80px 20px', gap: 20 }}>
                <div style={{ width: 76, height: 76, borderRadius: 22, background: 'var(--sunk)', display: 'grid', placeItems: 'center', color: 'var(--ink-3)' }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 9v12"/>
                  </svg>
                </div>
                <div>
                  <h2 className="h-display" style={{ fontSize: 24, marginBottom: 8 }}>{t('emptyTitle')}</h2>
                  <p style={{ fontSize: 14, color: 'var(--ink-3)', maxWidth: 340, lineHeight: 1.6, margin: '0 auto' }}>
                    {t('emptyText')}
                  </p>
                </div>
                <Link href="/workspace/new" className="btn btn-primary" style={{ textDecoration: 'none' }}>
                  + {t('newClient')}
                </Link>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }} className="kit-grid">
                {workspaces.map((ws, i) => (
                  <ClientKitCard key={ws.id} ws={ws} color={ws.primary_color || WS_COLORS[i % WS_COLORS.length]} index={i} />
                ))}
              </div>
            )}

            <style>{`
              @media(max-width:1080px){.kit-grid{grid-template-columns:repeat(2,1fr) !important}}
              @media(max-width:680px){.kit-grid{grid-template-columns:1fr !important}}
            `}</style>
          </div>
        </div>
      </div>
    </div>
  );
}
