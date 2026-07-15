"use client";

import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { BlogShell } from "./chrome";
import type { Post } from "./posts";

function formatDate(iso: string, locale: string) {
  return new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
}

// `Body` est un composant (une fonction) : ne peut pas transiter dans les
// props d'un Client Component (Next.js le sérialise et plante au build).
// Le Server Component parent ne passe donc que les champs texte du post.
type PostMeta = Omit<Post, "Body">;

export default function BlogIndexView({ posts }: { posts: PostMeta[] }) {
  const t = useTranslations('blog');
  const locale = useLocale();
  return (
    <BlogShell>
      <section className="section" style={{ paddingBottom: 40 }}>
        <div className="wrap">
          <span className="eyebrow plain">{t('indexEyebrow')}</span>
          <h1 className="display" style={{ fontSize: "clamp(38px, 6vw, 72px)", marginTop: 18 }}>
            {t('indexTitlePre')} <span className="it-serif acid-fill">{t('indexTitleAccent')}</span>
          </h1>
          <p className="lead" style={{ marginTop: 20, maxWidth: 560 }}>
            {t('indexLead')}
          </p>

          <div style={{ display: "flex", flexDirection: "column", marginTop: 56 }}>
            {posts.map((p, i) => (
              <Link
                key={p.slug}
                href={`/blog/${p.slug}`}
                style={{
                  display: "block",
                  padding: "30px 2px",
                  borderTop: "1px solid var(--line)",
                  borderBottom: i === posts.length - 1 ? "1px solid var(--line)" : "none",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
                  <div style={{ maxWidth: 640 }}>
                    <h2 style={{ fontFamily: "var(--heavy)", fontWeight: 800, fontSize: 24, letterSpacing: "-0.02em", marginBottom: 10 }}>{p.title}</h2>
                    <p style={{ color: "var(--ink-2)", fontSize: 16, lineHeight: 1.6 }}>{p.description}</p>
                  </div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--ink-3)", whiteSpace: "nowrap" }}>
                    {formatDate(p.date, locale)} · {t('minReadShort', { min: p.readMinutes })}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </BlogShell>
  );
}
