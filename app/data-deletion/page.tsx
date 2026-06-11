import Link from "next/link";

export const metadata = {
  title: "Suppression des données — Klip",
  description: "Comment supprimer les données associées à votre compte Facebook/Instagram sur Klip.",
  // Last updated: 2026-06-11
};

export default function DataDeletionPage() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--canvas)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "60px 24px",
      fontFamily: "var(--sans)",
    }}>
      <div style={{ maxWidth: 640, width: "100%" }}>

        {/* Logo */}
        <div style={{ marginBottom: 40 }}>
          <Link href="/" style={{ textDecoration: "none" }}>
            <span style={{
              fontFamily: "var(--display)", fontWeight: 900, fontSize: 26,
              letterSpacing: "-0.05em", lineHeight: 1, color: "var(--ink)",
              display: "inline-flex", alignItems: "center",
            }}>
              Kl<span style={{ color: "var(--mint)" }}>ip</span>
              <span style={{ width: 5, height: 5, background: "var(--mint)", borderRadius: "50%", marginLeft: 3, marginTop: 8, flexShrink: 0 }} />
            </span>
          </Link>
        </div>

        <h1 style={{
          fontFamily: "var(--display)", fontWeight: 800, fontSize: 32,
          color: "var(--ink)", letterSpacing: "-0.02em", marginBottom: 12,
        }}>
          Suppression des données
        </h1>

        <p style={{ fontSize: 14, color: "var(--ink-2)", marginBottom: 32, lineHeight: 1.7 }}>
          Conformément à la politique de Meta (Facebook/Instagram), vous pouvez demander la suppression
          de toutes les données que Klip a collectées via votre compte Facebook ou Instagram.
        </p>

        {/* Section 1 */}
        <section style={{ marginBottom: 28 }}>
          <h2 style={{
            fontFamily: "var(--display)", fontWeight: 700, fontSize: 16,
            color: "var(--ink)", marginBottom: 10, letterSpacing: "-0.01em",
          }}>
            Données collectées
          </h2>
          <p style={{ fontSize: 14, color: "var(--ink-2)", lineHeight: 1.7 }}>
            Lors de la connexion de votre compte Instagram Business à Klip, nous stockons :
          </p>
          <ul style={{ marginTop: 10, paddingLeft: 20, fontSize: 14, color: "var(--ink-2)", lineHeight: 2 }}>
            <li>Votre identifiant de compte Instagram</li>
            <li>Votre nom d'utilisateur Instagram</li>
            <li>Un token d'accès permettant de publier en votre nom</li>
            <li>L'identifiant de votre page Facebook associée</li>
          </ul>
        </section>

        {/* Section 2 */}
        <section style={{ marginBottom: 28 }}>
          <h2 style={{
            fontFamily: "var(--display)", fontWeight: 700, fontSize: 16,
            color: "var(--ink)", marginBottom: 10, letterSpacing: "-0.01em",
          }}>
            Comment supprimer vos données
          </h2>
          <p style={{ fontSize: 14, color: "var(--ink-2)", lineHeight: 1.7, marginBottom: 12 }}>
            Vous avez deux options pour supprimer vos données :
          </p>

          <div style={{
            background: "var(--card)", border: "1px solid var(--line-2)",
            borderRadius: "var(--r)", padding: "18px 20px", marginBottom: 12,
          }}>
            <p style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)", marginBottom: 6 }}>
              Option 1 — Depuis votre compte Klip
            </p>
            <p style={{ fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.6 }}>
              Connectez-vous à Klip, accédez aux{" "}
              <strong>Paramètres</strong> de votre workspace, puis cliquez sur{" "}
              <strong>Déconnecter Instagram</strong> ou{" "}
              <strong>Supprimer ce workspace</strong>. Toutes les données associées seront supprimées immédiatement.
            </p>
          </div>

          <div style={{
            background: "var(--card)", border: "1px solid var(--line-2)",
            borderRadius: "var(--r)", padding: "18px 20px",
          }}>
            <p style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)", marginBottom: 6 }}>
              Option 2 — Par e-mail
            </p>
            <p style={{ fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.6 }}>
              Envoyez une demande de suppression à{" "}
              <a
                href="mailto:privacy@klip.app"
                style={{ color: "var(--mint-2)", fontWeight: 600, textDecoration: "none" }}
              >
                privacy@klip.app
              </a>{" "}
              en précisant l'adresse e-mail associée à votre compte. Nous traiterons votre demande
              dans un délai de 30 jours.
            </p>
          </div>
        </section>

        {/* Section 3 */}
        <section style={{ marginBottom: 40 }}>
          <h2 style={{
            fontFamily: "var(--display)", fontWeight: 700, fontSize: 16,
            color: "var(--ink)", marginBottom: 10, letterSpacing: "-0.01em",
          }}>
            Ce qui sera supprimé
          </h2>
          <ul style={{ paddingLeft: 20, fontSize: 14, color: "var(--ink-2)", lineHeight: 2 }}>
            <li>Votre token d'accès Instagram</li>
            <li>Votre identifiant et nom d'utilisateur Instagram</li>
            <li>L'association avec votre page Facebook</li>
            <li>Sur demande de suppression complète : tous vos workspaces, posts et données associées</li>
          </ul>
        </section>

        {/* Footer */}
        <div style={{ borderTop: "1px solid var(--line-2)", paddingTop: 24 }}>
          <p style={{ fontSize: 13, color: "var(--ink-3)", lineHeight: 1.6 }}>
            Cette page est requise par Meta dans le cadre de la vérification de l'application Facebook.
            Pour toute question, contactez-nous à{" "}
            <a
              href="mailto:privacy@klip.app"
              style={{ color: "var(--ink-2)", textDecoration: "underline" }}
            >
              privacy@klip.app
            </a>.
          </p>
        </div>

      </div>
    </div>
  );
}
