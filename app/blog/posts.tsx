import Link from "next/link";

/* ─── Contenu du blog Klip ────────────────────────────────────────────────
   4 articles qui visent chacun une requête précise (niche "outil community
   manager multi-clients" / "alternative Metricool") plutôt que du contenu
   générique. Ajoutez un post ici + il apparaît automatiquement dans l'index
   (/blog), le sitemap et via generateStaticParams sur /blog/[slug]. */

export type Post = {
  slug: string;
  title: string;
  description: string;
  date: string; // ISO
  readMinutes: number;
  Body: () => React.ReactElement;
};

function H2({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontFamily: "var(--heavy)", fontWeight: 800, fontSize: "clamp(22px, 3vw, 30px)", letterSpacing: "-0.02em", marginTop: 48, marginBottom: 16 }}>{children}</h2>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p style={{ color: "var(--ink-2)", fontSize: 17, lineHeight: 1.75, marginBottom: 18 }}>{children}</p>;
}
function UL({ items }: { items: React.ReactNode[] }) {
  return (
    <ul style={{ margin: "0 0 22px", paddingLeft: 22, display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map((it, i) => <li key={i} style={{ color: "var(--ink-2)", fontSize: 17, lineHeight: 1.6 }}>{it}</li>)}
    </ul>
  );
}
function CTA() {
  return (
    <div style={{ background: "var(--paper-2)", boxShadow: "inset 0 0 0 1px var(--line-2)", borderRadius: "var(--radius)", padding: "30px 32px", marginTop: 44, textAlign: "center" }}>
      <p style={{ fontFamily: "var(--heavy)", fontWeight: 800, fontSize: 20, marginBottom: 16 }}>Essayez Klip gratuitement pendant 7 jours</p>
      <Link href="/register" className="btn btn-acid" style={{ justifyContent: "center", display: "inline-flex" }}>Créer un compte</Link>
    </div>
  );
}

export const POSTS: Post[] = [
  {
    slug: "meilleur-outil-community-manager-plusieurs-clients",
    title: "Le meilleur outil pour un community manager qui gère plusieurs clients",
    description:
      "Comparatif honnête des solutions pour centraliser la création, la planification et la validation client quand on gère plusieurs comptes Instagram à la fois.",
    date: "2026-01-12",
    readMinutes: 6,
    Body: () => (
      <>
        <P>
          Gérer un seul compte Instagram, n&apos;importe quel outil grand public suffit. Gérer cinq, dix ou vingt comptes clients en
          parallèle, c&apos;est une autre histoire : chaque marque a sa charte, son ton, son calendrier, ses validations — et la
          moindre confusion entre deux clients peut coûter cher en crédibilité.
        </P>
        <P>
          Voici ce qu&apos;un outil pensé pour les agences doit vraiment couvrir, et où la plupart des solutions « solo créateur »
          montrent leurs limites.
        </P>

        <H2>Ce qu&apos;un outil multi-clients doit vraiment faire</H2>
        <UL
          items={[
            <>Un espace cloisonné par client : charte, historique, comptes connectés séparés — rien ne se mélange.</>,
            <>Une génération de contenu (visuels + légendes) qui respecte le ton propre à chaque marque, pas un style unique pour tout le monde.</>,
            <>Un calendrier qui donne une vue d&apos;ensemble sur tous les clients à la fois, sans devoir changer d&apos;onglet ou de compte.</>,
            <>Un circuit de validation client qui ne demande rien à installer côté client.</>,
          ]}
        />

        <H2>Pourquoi les outils « solo créateur » ne suffisent pas</H2>
        <P>
          La majorité des outils de planification (pensés à l&apos;origine pour un créateur qui gère son propre compte) traitent le
          multi-comptes comme une fonctionnalité annexe : on peut ajouter des comptes, mais la charte de marque, la génération de
          légendes et la validation restent pensées pour un seul univers éditorial. Résultat : l&apos;agence rajoute Canva pour les
          visuels, ChatGPT pour les textes, un tableur ou Notion pour le suivi, et le mail ou WhatsApp pour faire valider — cinq outils
          à faire tourner en parallèle, pour un seul flux de travail.
        </P>

        <H2>Ce que change un outil pensé pour les agences</H2>
        <P>
          Klip part du principe inverse : chaque client a son espace, avec sa propre charte (ton, mots interdits, palette), son
          calendrier et son historique. L&apos;éditeur visuel, la génération de légendes par IA et le calendrier de planification
          vivent dans le même outil — et la validation se fait par un lien envoyé au client, qui approuve ou commente sans créer de
          compte. Tout part d&apos;un seul espace de travail, quel que soit le nombre de clients gérés.
        </P>

        <H2>Comment évaluer un outil avant de changer</H2>
        <UL
          items={[
            <>Testez avec au moins deux clients différents : la charte de l&apos;un déborde-t-elle sur l&apos;autre ?</>,
            <>Regardez le circuit de validation : combien d&apos;étapes pour qu&apos;un client donne son accord ?</>,
            <>Vérifiez le calendrier : peut-on voir tous les clients d&apos;un coup d&apos;œil, ou faut-il changer de compte à chaque fois ?</>,
            <>Comptez le nombre d&apos;abonnements que l&apos;outil remplace réellement, pas seulement ce qu&apos;il ajoute.</>,
          ]}
        />
        <CTA />
      </>
    ),
  },
  {
    slug: "alternative-metricool-agences",
    title: "Une alternative à Metricool pensée pour les agences multi-clients",
    description:
      "Metricool est solide pour la planification, mais une agence a besoin de plus : création visuelle, rédaction IA et validation client. Voici ce qui change avec Klip.",
    date: "2026-02-04",
    readMinutes: 5,
    Body: () => (
      <>
        <P>
          Metricool fait bien ce pour quoi il a été conçu : planifier et publier sur plusieurs réseaux, avec des statistiques
          claires. Pour une agence qui gère uniquement la diffusion, c&apos;est un bon choix. Le sujet, c&apos;est que la
          planification n&apos;est qu&apos;une étape du travail réel d&apos;une agence — avant elle, il y a la création visuelle et la
          rédaction ; après, il y a la validation client.
        </P>

        <H2>Ce que fait bien Metricool</H2>
        <P>
          Multi-réseaux, planification par calendrier, statistiques de performance : Metricool couvre correctement la partie
          « diffusion ». Ce n&apos;est pas un reproche — c&apos;est simplement son périmètre.
        </P>

        <H2>Ce qu&apos;une agence doit ajouter par-dessus</H2>
        <P>En pratique, une agence qui utilise Metricool y ajoute presque toujours :</P>
        <UL
          items={[
            <>Canva pour créer les visuels (posts, reels, stories, carrousels).</>,
            <>ChatGPT (ou équivalent) pour rédiger les légendes de chaque marque.</>,
            <>Un mail, WeTransfer ou WhatsApp pour faire valider les visuels par le client.</>,
            <>Un tableur ou Notion pour suivre qui a validé quoi, et pour quel client.</>,
          ]}
        />
        <P>
          Ce sont quatre outils supplémentaires — quatre abonnements, quatre interfaces, quatre endroits où l&apos;information peut se
          perdre entre deux personnes de l&apos;agence.
        </P>

        <H2>Ce que Klip réunit à la place</H2>
        <P>
          Klip couvre l&apos;ensemble de la chaîne dans un seul espace par client : éditeur visuel pour créer les posts, reels,
          stories et carrousels ; IA de rédaction qui s&apos;appuie sur la charte propre à chaque marque ; calendrier de
          planification multi-comptes ; lien de validation client sans compte à créer ; et publication automatique sur Instagram via
          l&apos;API officielle Meta. La planification reste au centre, mais elle n&apos;est plus la seule brique.
        </P>

        <H2>Faut-il migrer tout de suite ?</H2>
        <P>
          Pas besoin de tout changer d&apos;un coup. Klip se teste gratuitement pendant 7 jours, sans carte bancaire — l&apos;occasion
          de comparer sur un ou deux clients avant de généraliser.
        </P>
        <CTA />
      </>
    ),
  },
  {
    slug: "validation-client-reseaux-sociaux-sans-perdre-de-temps",
    title: "Validation client sur Instagram : comment arrêter les allers-retours par mail",
    description:
      "Fils de mail interminables, PDF exportés à la main, retours dispersés dans WhatsApp — voici comment structurer une vraie validation client.",
    date: "2026-03-18",
    readMinutes: 5,
    Body: () => (
      <>
        <P>
          « Je t&apos;ai envoyé les visuels hier, tu as eu le temps de regarder ? » — cette phrase revient dans presque toutes les
          agences qui gèrent la validation client par mail ou WhatsApp. Le contenu est prêt depuis longtemps, mais il reste bloqué en
          attente d&apos;un retour dispersé entre plusieurs canaux.
        </P>

        <H2>Pourquoi le mail, le PDF et WhatsApp ne suffisent pas</H2>
        <P>
          Un PDF exporté à la main perd le contexte (date de publication prévue, légende, format). Un fil de mail s&apos;étale sur
          plusieurs échanges et personne ne sait qui a eu le dernier mot. WhatsApp mélange la validation avec le reste de la
          conversation, et rien n&apos;est historisé proprement d&apos;un mois sur l&apos;autre.
        </P>

        <H2>Ce qu&apos;un bon système de validation doit permettre</H2>
        <UL
          items={[
            <>Un lien envoyé au client, sans compte à créer ni application à installer.</>,
            <>Un statut visible par post directement dans le calendrier : validé, en attente, à retoucher.</>,
            <>Un commentaire du client rattaché au post concerné, pas noyé dans un fil de discussion.</>,
            <>Une notification automatique dès qu&apos;un client valide ou commente, sans avoir à relancer.</>,
          ]}
        />

        <H2>Comment Klip structure la validation</H2>
        <P>
          Chaque post du calendrier peut être envoyé en validation via un lien unique : le client approuve ou commente directement,
          sans rien installer de son côté. L&apos;agence reçoit une notification in-app dès qu&apos;un retour arrive, et le planning
          affiche en un coup d&apos;œil le nombre de posts validés et en attente pour chaque client. Plus besoin d&apos;ouvrir un mail
          pour savoir où en est une validation.
        </P>
        <CTA />
      </>
    ),
  },
  {
    slug: "gerer-plusieurs-comptes-instagram-agence",
    title: "Comment gérer plusieurs comptes Instagram clients sans s'épuiser",
    description:
      "Entre les connexions API, les chartes de marque différentes et les plannings qui se chevauchent, gérer 5, 10 ou 20 comptes clients demande une organisation précise.",
    date: "2026-04-22",
    readMinutes: 6,
    Body: () => (
      <>
        <P>
          Chaque compte client supplémentaire ajoute un peu de charge : une charte à respecter, un calendrier à tenir, des
          validations à suivre. Pris un par un, c&apos;est gérable. Multiplié par dix ou vingt clients, la charge devient vite le
          vrai facteur limitant d&apos;une agence — bien avant le manque de créativité.
        </P>

        <H2>Le vrai coût du micro-management multi-comptes</H2>
        <P>
          Changer de compte, retrouver la charte du bon client, se souvenir du ton à adopter, vérifier qui a déjà validé quoi : chacune
          de ces micro-tâches prend quelques secondes, mais elles s&apos;accumulent sur une journée entière — et elles sont la
          première source d&apos;erreurs (mauvais ton, mauvaise légende, mauvais client).
        </P>

        <H2>Cloisonner sans multiplier les outils</H2>
        <P>
          La tentation classique est d&apos;ajouter un outil par problème : un pour la création, un pour la planification, un
          tableur pour le suivi. Chaque outil ajouté est un nouvel endroit où l&apos;information peut se désynchroniser entre deux
          clients. L&apos;alternative est de cloisonner à l&apos;intérieur d&apos;un seul outil : un espace par client, avec sa
          charte, ses comptes connectés et son historique propre, sans jamais mélanger deux marques.
        </P>

        <H2>Automatiser ce qui peut l&apos;être</H2>
        <UL
          items={[
            <>La rédaction des légendes, générée dans le ton défini une fois par client — puis ajustée d&apos;un clic si besoin.</>,
            <>La publication elle-même, programmée à l&apos;avance et envoyée automatiquement à l&apos;heure prévue.</>,
            <>La relance de validation, via une notification plutôt qu&apos;un message manuel à chaque client.</>,
          ]}
        />

        <H2>Garder une vue d&apos;ensemble</H2>
        <P>
          Le calendrier reste le point de passage obligé : pouvoir voir, en un seul écran, ce qui est prévu pour tous les clients de
          la semaine — plutôt que de rouvrir un compte après l&apos;autre. C&apos;est ce qui permet de repérer un trou dans le
          planning d&apos;un client avant qu&apos;il ne devienne un problème.
        </P>
        <CTA />
      </>
    ),
  },
];

export function getPost(slug: string): Post | undefined {
  return POSTS.find((p) => p.slug === slug);
}
