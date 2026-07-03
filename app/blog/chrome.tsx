import Link from "next/link";
import { KlipLogo, V2_CSS } from "../landing-view";

/* ─── Chrome partagé des pages /blog — même charte visuelle que la landing
   (V2_CSS), mais header/footer simplifiés : pas d'ancres de section (#faq,
   #tarifs…) qui n'ont de sens que sur la page d'accueil. */

function BlogHeader() {
  return (
    <header style={{ borderBottom: "1px solid var(--line)", position: "sticky", top: 0, zIndex: 40, background: "var(--paper-2)" }}>
      <div className="wrap" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 76 }}>
        <Link href="/" style={{ display: "flex", alignItems: "center" }}><KlipLogo size={26} /></Link>
        <nav style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <Link href="/blog" style={{ fontFamily: "var(--mono)", fontSize: 13.5, fontWeight: 700, color: "var(--ink-2)" }}>Blog</Link>
          <Link href="/login" style={{ fontFamily: "var(--mono)", fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>Connexion</Link>
          <Link href="/register" className="btn btn-acid btn-sm">Essai gratuit</Link>
        </nav>
      </div>
    </header>
  );
}

function BlogFooter() {
  return (
    <footer className="on-forest" style={{ paddingTop: 56, paddingBottom: 36, borderTop: "1px solid var(--line-f)", marginTop: 90 }}>
      <div className="wrap" style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 20, alignItems: "center" }}>
        <KlipLogo size={26} light />
        <div style={{ display: "flex", gap: 22, flexWrap: "wrap", fontFamily: "var(--mono)", fontSize: 13.5 }}>
          <Link href="/" style={{ color: "var(--cream-2)" }}>Accueil</Link>
          <Link href="/blog" style={{ color: "var(--cream-2)" }}>Blog</Link>
          <Link href="/register" style={{ color: "var(--cream-2)" }}>Créer un compte</Link>
          <Link href="/mentions-legales" style={{ color: "var(--cream-2)" }}>Mentions légales</Link>
        </div>
      </div>
    </footer>
  );
}

export function BlogShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="v2">
      <style dangerouslySetInnerHTML={{ __html: V2_CSS }} />
      <BlogHeader />
      {children}
      <BlogFooter />
    </div>
  );
}
