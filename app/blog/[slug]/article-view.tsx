"use client";

import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { BlogShell } from "../chrome";
import type { Post } from "../posts";

function formatDate(iso: string, locale: string) {
  return new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
}

export default function BlogArticleView({ post }: { post: Post }) {
  const t = useTranslations('blog');
  const locale = useLocale();
  return (
    <BlogShell>
      <article className="section" style={{ paddingBottom: 40 }}>
        <div className="wrap" style={{ maxWidth: 720 }}>
          <Link href="/blog" style={{ fontFamily: "var(--mono)", fontSize: 13.5, fontWeight: 700, color: "var(--ink-2)" }}>{t('backToBlog')}</Link>
          <h1 className="display" style={{ fontSize: "clamp(32px, 5vw, 56px)", marginTop: 22 }}>{post.title}</h1>
          <p style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--ink-3)", marginTop: 16 }}>
            {formatDate(post.date, locale)} · {t('minReadLong', { min: post.readMinutes })}
          </p>
          <div style={{ marginTop: 36 }}>
            <post.Body />
          </div>
        </div>
      </article>
    </BlogShell>
  );
}
