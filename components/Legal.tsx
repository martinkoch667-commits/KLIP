import Link from "next/link";

/* Shell + helpers partagés par les pages légales (mentions légales, CGU, cookies).
   Style aligné sur app/privacy/page.tsx. */

export function LegalShell({ kicker, title, updated, children }: { kicker: string; title: string; updated: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--canvas, #F5F4F0)", minHeight: "100vh", fontFamily: "var(--sans, 'DM Sans', sans-serif)" }}>
      <header style={{ borderBottom: "1px solid rgba(13,15,10,.08)", padding: "0 32px", height: 56, display: "flex", alignItems: "center", background: "var(--paper, #FAFAF8)" }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <img src="/logo-klip-dark.png" alt="Klip" style={{ height: 28, width: "auto" }} />
        </Link>
        <span style={{ marginLeft: "auto", fontSize: 13, color: "var(--ink-3, #9A9B97)" }}>{kicker}</span>
      </header>
      <main style={{ maxWidth: 760, margin: "0 auto", padding: "56px 24px 96px" }}>
        <div style={{ marginBottom: 48 }}>
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-3, #9A9B97)", marginBottom: 12, fontFamily: "var(--display, 'Archivo Black', sans-serif)" }}>{kicker}</p>
          <h1 style={{ fontFamily: "var(--display, 'Archivo Black', sans-serif)", fontWeight: 900, fontSize: 40, color: "var(--ink, #0D0F0A)", letterSpacing: "-0.03em", lineHeight: 1.1, marginBottom: 14 }}>{title}</h1>
          <p style={{ fontSize: 14, color: "var(--ink-3, #9A9B97)", fontWeight: 500 }}>{updated}</p>
        </div>
        {children}
      </main>
    </div>
  );
}

export const lProse: React.CSSProperties = { fontSize: 15, lineHeight: 1.75, color: "var(--ink-2, #3D3F3A)", marginBottom: 14 };
export const lList: React.CSSProperties = { paddingLeft: 22, marginBottom: 14 };
export const lLi: React.CSSProperties = { fontSize: 15, lineHeight: 1.75, color: "var(--ink-2, #3D3F3A)", marginBottom: 6 };
export const lLink: React.CSSProperties = { color: "var(--mint-2, #1FA87D)", textDecoration: "underline", textUnderlineOffset: 3 };

export function LSection({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 8 }}>
      <h2 style={{ fontFamily: "var(--display, 'Archivo Black', sans-serif)", fontWeight: 900, fontSize: 22, color: "var(--ink, #0D0F0A)", letterSpacing: "-0.02em", marginBottom: 18, display: "flex", alignItems: "baseline", gap: 10 }}>
        <span style={{ fontFamily: "var(--mono, monospace)", fontSize: 13, fontWeight: 700, color: "var(--ink-3, #9A9B97)", minWidth: 20 }}>{n}.</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function LDivider() {
  return <hr style={{ border: "none", borderTop: "1px solid rgba(13,15,10,.07)", margin: "36px 0" }} />;
}

/* Encadré "à compléter" pour les infos manquantes */
export function LTodo({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ background: "rgba(200,115,43,.14)", color: "#9a5a1f", padding: "1px 7px", borderRadius: 5, fontWeight: 600, fontSize: 14 }}>{children}</span>
  );
}
