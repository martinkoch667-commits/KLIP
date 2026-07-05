import { LegalShell, LSection, LDivider, LTodo, lProse, lList, lLi, lLink } from "@/components/Legal";

export const metadata = {
  title: "Conditions générales d'utilisation — Klip",
  description: "Conditions générales d'utilisation et de vente du service Klip.",
};

export default function Conditions() {
  return (
    <LegalShell kicker="Légal" title="Conditions générales (CGU / CGV)" updated="Dernière mise à jour : 21 juin 2026">
      <p style={lProse}>
        Les présentes conditions générales régissent l&apos;utilisation du service <strong>Klip</strong> (le « Service »), édité par Martin Koch (micro-entreprise, SIREN&nbsp;931&nbsp;920&nbsp;821). En créant un compte, vous acceptez ces conditions sans réserve.
      </p>

      <LDivider />

      <LSection n="1" title="Objet du service">
        <p style={lProse}>
          Klip est un outil de post-production des réseaux sociaux permettant de créer des visuels, générer des descriptions par IA, planifier et publier du contenu Instagram/Facebook pour plusieurs marques (« clients ») depuis un espace unique.
        </p>
      </LSection>

      <LDivider />

      <LSection n="2" title="Compte & accès">
        <ul style={lList}>
          <li style={lLi}>La création d&apos;un compte nécessite une adresse e-mail valide. Vous êtes responsable de la confidentialité de vos identifiants.</li>
          <li style={lLi}>Vous garantissez l&apos;exactitude des informations fournies et vous engagez à ne pas usurper l&apos;identité d&apos;un tiers.</li>
          <li style={lLi}>Le Service est réservé aux personnes majeures ou disposant de la capacité juridique de contracter.</li>
        </ul>
      </LSection>

      <LDivider />

      <LSection n="3" title="Offres, essai gratuit et prix">
        <ul style={lList}>
          <li style={lLi}>Le Service est proposé sous forme d&apos;abonnement mensuel, selon deux offres : <strong>Studio</strong> et <strong>Agence</strong>, dont les caractéristiques et tarifs sont indiqués sur la page Tarifs.</li>
          <li style={lLi}>Chaque nouveau compte bénéficie d&apos;un <strong>essai gratuit de 7 jours</strong>, sans carte bancaire requise à l&apos;inscription.</li>
          <li style={lLi}>À l&apos;issue des 7 jours, l&apos;accès aux fonctionnalités est suspendu jusqu&apos;à la souscription d&apos;une offre payante.</li>
          <li style={lLi}>Les prix sont indiqués en euros. <LTodo>[Préciser TTC/HT et TVA applicable]</LTodo>.</li>
          <li style={lLi}>Le paiement s&apos;effectue via notre prestataire de paiement <LTodo>[Stripe — à activer]</LTodo>. Aucune donnée de carte n&apos;est stockée par Klip.</li>
        </ul>
      </LSection>

      <LDivider />

      <LSection n="4" title="Limites par offre">
        <p style={lProse}>Chaque offre comporte des limites (nombre de clients, de membres d&apos;équipe, fonctionnalités). Lorsque vous atteignez une limite, l&apos;action correspondante est bloquée jusqu&apos;à la montée en offre supérieure.</p>
      </LSection>

      <LDivider />

      <LSection n="5" title="Résiliation & droit de rétractation">
        <ul style={lList}>
          <li style={lLi}>L&apos;abonnement est sans engagement et résiliable à tout moment depuis les paramètres du compte ; il prend fin à l&apos;échéance de la période en cours.</li>
          <li style={lLi}>Conformément à l&apos;article L221-28 du Code de la consommation, vous reconnaissez qu&apos;en démarrant l&apos;exécution du Service pendant le délai de rétractation, vous renoncez à ce droit pour la part exécutée.</li>
          <li style={lLi}>L&apos;éditeur peut suspendre un compte en cas de manquement aux présentes conditions ou d&apos;usage frauduleux.</li>
        </ul>
      </LSection>

      <LDivider />

      <LSection n="6" title="Obligations de l'utilisateur">
        <ul style={lList}>
          <li style={lLi}>Ne pas publier de contenu illicite, diffamatoire, contrefaisant ou portant atteinte aux droits de tiers.</li>
          <li style={lLi}>Respecter les conditions d&apos;utilisation des plateformes tierces connectées (Meta / Instagram).</li>
          <li style={lLi}>Disposer des droits nécessaires sur les visuels, polices et marques téléversés.</li>
        </ul>
      </LSection>

      <LDivider />

      <LSection n="7" title="Disponibilité & responsabilité">
        <p style={lProse}>
          Le Service est fourni « en l&apos;état », en phase bêta. L&apos;éditeur ne saurait être tenu responsable des interruptions, pertes de données indépendantes de sa volonté, ou du comportement des API tierces (notamment Meta). La responsabilité de l&apos;éditeur est limitée au montant des sommes versées au cours des 12 derniers mois.
        </p>
      </LSection>

      <LDivider />

      <LSection n="8" title="Droit applicable & litiges">
        <p style={lProse}>
          Les présentes conditions sont soumises au droit français. En cas de litige, une solution amiable sera recherchée avant toute action. À défaut, les tribunaux français sont compétents. Conformément à l&apos;article L612-1 du Code de la consommation, vous pouvez recourir gratuitement à un médiateur de la consommation : <LTodo>[Médiateur à désigner]</LTodo>.
        </p>
      </LSection>

      <LDivider />

      <LSection n="9" title="Contact">
        <p style={lProse}>Pour toute question relative aux présentes conditions : <a href="mailto:getklipsaas@gmail.com" style={lLink}>getklipsaas@gmail.com</a>.</p>
      </LSection>
    </LegalShell>
  );
}
