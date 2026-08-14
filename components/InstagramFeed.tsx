"use client";

// Aperçu du feed — la grille du profil Instagram telle qu'elle sera une fois les
// posts publiés. Pas une liste de vignettes : l'en-tête de profil, la gouttière
// de 2px et le ratio 4:5 du client Instagram, pour juger l'harmonie du compte
// d'un coup d'œil (le vrai usage d'un community manager).
//
// Les stories sont exclues — elles n'apparaissent jamais dans la grille — et les
// posts pas encore publiés portent un liseré, pour distinguer le réel du prévu.

import Link from "next/link";
import MediaThumb, { pickThumbSource } from "@/components/MediaThumb";

export interface FeedPost {
  id: string;
  post_type?: string | null;
  status: string;
  scheduled_at?: string | null;
  exported_image_url?: string | null;
  thumbnail_url?: string | null;
  photo_url?: string | null;
}

export interface FeedAccount {
  name?: string | null;
  instagram_username?: string | null;
  logo_url?: string | null;
}

function Thumb({ raw }: { raw?: string | null }) {
  if (!raw) return <div style={{ width: "100%", height: "100%", background: "var(--sunk)" }} />;
  return <MediaThumb raw={raw} />;
}

export default function InstagramFeed({
  posts, account, workspaceId, limit = 12, compact = false, showHeader = true,
}: {
  posts: FeedPost[];
  account?: FeedAccount | null;
  workspaceId: string;
  limit?: number;
  /** Version resserrée pour un volet latéral. */
  compact?: boolean;
  showHeader?: boolean;
}) {
  const feed = posts
    .filter(p => (p.post_type ?? "post") !== "story")
    .filter(p => p.scheduled_at || p.status === "published")
    .sort((a, b) => {
      const da = a.scheduled_at ? new Date(a.scheduled_at).getTime() : 0;
      const db = b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0;
      return db - da; // le plus récent en haut à gauche, comme le profil
    })
    .slice(0, limit);

  const published = feed.filter(p => p.status === "published").length;
  const handle = account?.instagram_username || account?.name || "votrecompte";
  const gap = compact ? 2 : 3;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: compact ? 10 : 16 }}>
      {showHeader && (
        <div style={{ display: "flex", alignItems: "center", gap: compact ? 12 : 18 }}>
          <div style={{
            width: compact ? 52 : 78, height: compact ? 52 : 78, borderRadius: "50%", flexShrink: 0,
            overflow: "hidden", background: "var(--sunk)", display: "grid", placeItems: "center",
            boxShadow: "0 0 0 2px var(--white), 0 0 0 4px var(--leaf)",
          }}>
            {account?.logo_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={`/api/proxy-image?url=${encodeURIComponent(account.logo_url)}`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <span style={{ fontFamily: "var(--mono)", fontWeight: 800, color: "var(--ink-3)" }}>{handle.slice(0, 2).toUpperCase()}</span>}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: compact ? 14 : 18, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              @{handle}
            </div>
            <div style={{ display: "flex", gap: compact ? 12 : 20, marginTop: 4 }}>
              {[
                { n: feed.length, l: "posts" },
                { n: published, l: "publiés" },
                { n: feed.length - published, l: "à venir" },
              ].map(s => (
                <span key={s.l} style={{ fontSize: compact ? 11.5 : 13, color: "var(--ink-2)" }}>
                  <b style={{ color: "var(--ink)", fontFamily: "var(--mono)", fontWeight: 800 }}>{s.n}</b> {s.l}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {feed.length === 0 ? (
        <p style={{ fontSize: 12.5, color: "var(--ink-3)", margin: 0, lineHeight: 1.5 }}>
          Programmez des posts : la grille du compte se construit ici.
        </p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap, background: "var(--line-2)", padding: gap, borderRadius: compact ? 8 : 12, overflow: "hidden" }}>
          {feed.map(p => {
            const type = (p.post_type ?? "post") as string;
            const isPub = p.status === "published";
            const raw = pickThumbSource(p.exported_image_url, p.thumbnail_url, p.photo_url);
            return (
              <Link
                key={p.id}
                href={`/workspace/${workspaceId}/editor/${p.id}`}
                title={p.scheduled_at ? new Date(p.scheduled_at).toLocaleDateString() : undefined}
                style={{ position: "relative", aspectRatio: "4 / 5", background: "var(--sunk)", display: "block", overflow: "hidden" }}
              >
                <Thumb raw={raw} />
                {/* Prévu ≠ publié : un liseré leaf, jamais de pointillé. */}
                {!isPub && <span style={{ position: "absolute", inset: 0, boxShadow: "inset 0 0 0 2px var(--leaf)", pointerEvents: "none" }} />}
                {(type === "reel" || type === "carrousel") && (
                  <span style={{ position: "absolute", top: 6, right: 6, color: "#fff", filter: "drop-shadow(0 1px 3px rgba(0,0,0,.7))", display: "grid" }}>
                    {type === "reel"
                      ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 3l14 9-14 9V3Z" /></svg>
                      : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="3" width="13" height="13" rx="2" /><path d="M4 8v11a2 2 0 0 0 2 2h11" /></svg>}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
