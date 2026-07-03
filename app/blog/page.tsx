import type { Metadata } from "next";
import Link from "next/link";
import { BlogShell } from "./chrome";
import { POSTS } from "./posts";

export const metadata: Metadata = {
  title: "Blog — Klip",
  description:
    "Articles pour les agences et community managers qui gèrent plusieurs clients Instagram : outils, organisation, validation client.",
  alternates: { canonical: "/blog" },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export default function BlogIndex() {
  return (
    <BlogShell>
      <section className="section" style={{ paddingBottom: 40 }}>
        <div className="wrap">
          <span className="eyebrow plain">Blog</span>
          <h1 className="display" style={{ fontSize: "clamp(38px, 6vw, 72px)", marginTop: 18 }}>
            Gérer plusieurs clients, <span className="it-serif acid-fill">sans s&apos;épuiser.</span>
          </h1>
          <p className="lead" style={{ marginTop: 20, maxWidth: 560 }}>
            Organisation, outils, validation client — des articles écrits pour les agences et community managers qui gèrent plusieurs comptes Instagram à la fois.
          </p>

          <div style={{ display: "flex", flexDirection: "column", marginTop: 56 }}>
            {POSTS.map((p, i) => (
              <Link
                key={p.slug}
                href={`/blog/${p.slug}`}
                style={{
                  display: "block",
                  padding: "30px 2px",
                  borderTop: "1px solid var(--line)",
                  borderBottom: i === POSTS.length - 1 ? "1px solid var(--line)" : "none",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
                  <div style={{ maxWidth: 640 }}>
                    <h2 style={{ fontFamily: "var(--heavy)", fontWeight: 800, fontSize: 24, letterSpacing: "-0.02em", marginBottom: 10 }}>{p.title}</h2>
                    <p style={{ color: "var(--ink-2)", fontSize: 16, lineHeight: 1.6 }}>{p.description}</p>
                  </div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--ink-3)", whiteSpace: "nowrap" }}>
                    {formatDate(p.date)} · {p.readMinutes} min
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
