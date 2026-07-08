import { LegalShell, LSection, LDivider, lProse, lList, lLi, lLink } from "@/components/Legal";

export const metadata = {
  title: "Politique cookies — Klip",
  description: "Utilisation des cookies et traceurs sur Klip.",
};

export default function Cookies() {
  return (
    <LegalShell kicker="Légal" title="Politique cookies" updated="Dernière mise à jour : 21 juin 2026">
      <p style={lProse}>
        Cette politique explique comment <strong>Klip</strong> utilise les cookies et technologies similaires. Un cookie est un petit fichier déposé sur votre appareil lors de la visite d&apos;un site.
      </p>

      <LDivider />

      <LSection n="1" title="Cookies strictement nécessaires">
        <p style={lProse}>
          Klip utilise uniquement des cookies <strong>indispensables au fonctionnement</strong> du service, notamment pour :
        </p>
        <ul style={lList}>
          <li style={lLi}>maintenir votre <strong>session de connexion</strong> (authentification Supabase) ;</li>
          <li style={lLi}>assurer la <strong>sécurité</strong> et la continuité de navigation entre les pages.</li>
        </ul>
        <p style={lProse}>
          Ces cookies sont exemptés de consentement préalable conformément aux recommandations de la CNIL, car strictement nécessaires à la fourniture du service que vous demandez.
        </p>
      </LSection>

      <LDivider />

      <LSection n="2" title="Cookies de mesure d'audience & marketing">
        <p style={lProse}>
          Klip peut utiliser le <strong>Meta Pixel</strong> (Meta Platforms Ireland Ltd.), un traceur de mesure d&apos;audience qui nous permet de comprendre la performance de nos pages et de nos campagnes. Il enregistre par exemple les visites de page et l&apos;inscription à la liste d&apos;attente.
        </p>
        <p style={lProse}>
          Ce traceur <strong>n&apos;est déposé qu&apos;après votre consentement explicite</strong>, recueilli via le bandeau affiché lors de votre première visite. Tant que vous n&apos;avez pas cliqué sur « Accepter », aucun traceur publicitaire n&apos;est chargé. Vous pouvez refuser sans conséquence sur l&apos;utilisation du service.
        </p>
        <p style={lProse}>
          Pour revenir sur votre choix, effacez les cookies et données de site de votre navigateur pour Klip : le bandeau réapparaîtra à la visite suivante.
        </p>
      </LSection>

      <LDivider />

      <LSection n="3" title="Services tiers">
        <p style={lProse}>
          Lors de la connexion d&apos;un compte Instagram/Facebook via Meta, ou de l&apos;utilisation de prestataires (Supabase, Vercel), ces services peuvent déposer leurs propres cookies techniques, régis par leurs politiques respectives.
        </p>
      </LSection>

      <LDivider />

      <LSection n="4" title="Gérer les cookies">
        <p style={lProse}>
          Vous pouvez à tout moment configurer votre navigateur pour refuser ou supprimer les cookies. Le blocage des cookies strictement nécessaires peut toutefois empêcher la connexion au service.
        </p>
      </LSection>

      <LDivider />

      <LSection n="5" title="Contact">
        <p style={lProse}>
          Questions sur les cookies ou vos données : voir notre{" "}
          <a href="/privacy" style={lLink}>Politique de confidentialité</a> ou écrivez à{" "}
          <a href="mailto:getklipsaas@gmail.com" style={lLink}>getklipsaas@gmail.com</a>.
        </p>
      </LSection>
    </LegalShell>
  );
}
