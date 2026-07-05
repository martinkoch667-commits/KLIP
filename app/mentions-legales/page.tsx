import { LegalShell, LSection, LDivider, LTodo, lProse, lLink } from "@/components/Legal";

export const metadata = {
  title: "Mentions légales — Klip",
  description: "Mentions légales du service Klip.",
};

export default function MentionsLegales() {
  return (
    <LegalShell kicker="Légal" title="Mentions légales" updated="Dernière mise à jour : 21 juin 2026">
      <p style={lProse}>
        Conformément aux articles 6-III et 19 de la loi n°2004-575 du 21 juin 2004 pour la confiance dans l&apos;économie numérique (LCEN), il est précisé aux utilisateurs du service <strong>Klip</strong> l&apos;identité des différents intervenants dans le cadre de sa réalisation et de son suivi.
      </p>

      <LDivider />

      <LSection n="1" title="Éditeur du site">
        <div style={{ background: "var(--paper, #FAFAF8)", border: "1px solid rgba(13,15,10,.08)", borderRadius: 14, padding: "24px 28px" }}>
          <p style={{ ...lProse, marginBottom: 6 }}><strong>Martin Koch</strong></p>
          <p style={{ ...lProse, marginBottom: 6 }}>Entrepreneur individuel — micro-entreprise</p>
          <p style={{ ...lProse, marginBottom: 6 }}>SIREN : 931&nbsp;920&nbsp;821</p>
          <p style={{ ...lProse, marginBottom: 6 }}>Adresse : <LTodo>[ADRESSE POSTALE À COMPLÉTER]</LTodo></p>
          <p style={{ ...lProse, marginBottom: 6 }}>Email : <a href="mailto:getklipsaas@gmail.com" style={lLink}>getklipsaas@gmail.com</a></p>
          <p style={{ ...lProse, marginBottom: 0 }}>TVA intracommunautaire : <LTodo>[N° TVA OU « Non applicable, art. 293 B du CGI »]</LTodo></p>
        </div>
      </LSection>

      <LDivider />

      <LSection n="2" title="Directeur de la publication">
        <p style={lProse}>Le directeur de la publication est Martin Koch, en sa qualité d&apos;éditeur du service.</p>
      </LSection>

      <LDivider />

      <LSection n="3" title="Hébergement">
        <p style={lProse}>Le site est hébergé par :</p>
        <p style={lProse}>
          <strong>Vercel Inc.</strong> — 340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis —{" "}
          <a href="https://vercel.com" style={lLink}>vercel.com</a>
        </p>
        <p style={lProse}>
          Les données applicatives sont stockées via <strong>Supabase</strong> —{" "}
          <a href="https://supabase.com" style={lLink}>supabase.com</a>.
        </p>
      </LSection>

      <LDivider />

      <LSection n="4" title="Propriété intellectuelle">
        <p style={lProse}>
          L&apos;ensemble des éléments du service Klip (structure, textes, logos, interface, code) est protégé par le droit de la propriété intellectuelle et demeure la propriété exclusive de l&apos;éditeur, sauf mention contraire. Toute reproduction, représentation ou exploitation non autorisée est interdite.
        </p>
        <p style={lProse}>
          Les contenus que vous créez et importez (visuels, textes, chartes de vos clients) restent votre propriété. Vous restez seul responsable des droits attachés aux contenus que vous téléversez.
        </p>
      </LSection>

      <LDivider />

      <LSection n="5" title="Responsabilité">
        <p style={lProse}>
          L&apos;éditeur s&apos;efforce d&apos;assurer l&apos;exactitude et la mise à jour des informations diffusées, sans pouvoir en garantir l&apos;exhaustivité. Le service est fourni « en l&apos;état » durant sa phase bêta ; des interruptions ou évolutions peuvent survenir.
        </p>
      </LSection>

      <LDivider />

      <LSection n="6" title="Données personnelles & cookies">
        <p style={lProse}>
          Le traitement de vos données personnelles est décrit dans notre{" "}
          <a href="/privacy" style={lLink}>Politique de confidentialité</a> et notre{" "}
          <a href="/cookies" style={lLink}>Politique cookies</a>.
        </p>
      </LSection>

      <LDivider />

      <LSection n="7" title="Contact">
        <p style={lProse}>
          Pour toute question : <a href="mailto:getklipsaas@gmail.com" style={lLink}>getklipsaas@gmail.com</a>.
        </p>
      </LSection>
    </LegalShell>
  );
}
