import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BlogShell } from "../chrome";
import { POSTS, getPost } from "../posts";

const SITE = "https://getklip.fr";

export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const post = getPost(params.slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.description,
      url: `${SITE}/blog/${post.slug}`,
      publishedTime: post.date,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
    },
  };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export default function BlogArticle({ params }: { params: { slug: string } }) {
  const post = getPost(params.slug);
  if (!post) notFound();

  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    author: { "@type": "Organization", name: "Klip" },
    publisher: { "@type": "Organization", name: "Klip" },
    mainEntityOfPage: `${SITE}/blog/${post.slug}`,
  };

  return (
    <BlogShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }} />
      <article className="section" style={{ paddingBottom: 40 }}>
        <div className="wrap" style={{ maxWidth: 720 }}>
          <Link href="/blog" style={{ fontFamily: "var(--mono)", fontSize: 13.5, fontWeight: 700, color: "var(--ink-2)" }}>← Blog</Link>
          <h1 className="display" style={{ fontSize: "clamp(32px, 5vw, 56px)", marginTop: 22 }}>{post.title}</h1>
          <p style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--ink-3)", marginTop: 16 }}>
            {formatDate(post.date)} · {post.readMinutes} min de lecture
          </p>
          <div style={{ marginTop: 36 }}>
            <post.Body />
          </div>
        </div>
      </article>
    </BlogShell>
  );
}
