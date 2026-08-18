import type { Metadata } from "next";
import LandingView from "../landing-v3";
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import { getMessages } from "@/lib/i18n/messages";
import { launchSeatsLeft } from "@/lib/launch-seats";

const SITE = "https://getklip.fr";

export const metadata: Metadata = {
  title: "Klip — L'outil tout-en-un pour les agences qui gèrent l'Instagram de plusieurs clients",
  description:
    "Création visuelle, légendes IA, planification et validation client. Klip réunit toute la production de contenu Instagram de vos clients dans un seul outil. 7 jours d'essai gratuit.",
  keywords:
    "outil community manager, gestion réseaux sociaux agence, planification instagram, validation client, plusieurs comptes instagram",
  authors: [{ name: "Klip" }],
  alternates: { canonical: "/fr" },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: `${SITE}/fr`,
    siteName: "Klip",
    title: "Klip — Le studio social tout-en-un pour les agences",
    description:
      "Création visuelle, légendes IA, planification et validation client — dans un seul outil.",
    // image fournie par app/opengraph-image.tsx (route dynamique)
  },
  twitter: {
    card: "summary_large_image",
    title: "Klip — Le studio social pour agences & community managers",
    description: "Toute la production de contenu Instagram de vos clients dans un seul outil.",
  },
  robots: { index: true, follow: true },
};

const organizationLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Klip",
  url: SITE,
  logo: `${SITE}/logo-klip-dark.png`,
  description:
    "Klip est le studio social tout-en-un pour les agences et les community managers : éditeur visuel, légendes IA, montage vidéo, calendrier et publication Instagram automatique.",
};

const websiteLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Klip",
  url: SITE,
  inLanguage: ["fr", "en"],
  publisher: { "@type": "Organization", name: "Klip", url: SITE },
};

const softwareLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Klip",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: `${SITE}/fr`,
  inLanguage: "fr",
  description:
    "Outil tout-en-un de création et de planification de contenu Instagram pour les agences : éditeur visuel, légendes IA, calendrier, validation client et publication automatique.",
  featureList: [
    "Éditeur visuel pour posts et carrousels",
    "Légendes IA générées dans la voix de chaque marque",
    "Montage vidéo (sous-titres, transitions, assemblage automatique)",
    "Calendrier éditorial et planification",
    "Validation client par lien, sans compte requis",
    "Publication Instagram automatique",
    "Gestion multi-clients cloisonnée",
  ],
  offers: [
    { "@type": "Offer", name: "Studio", price: "35.00", priceCurrency: "EUR", category: "subscription" },
    { "@type": "Offer", name: "Agence", price: "96.00", priceCurrency: "EUR", category: "subscription" },
  ],
};

// Reprend les questions/réponses réelles de la section FAQ de la landing (FR)
const FAQ = [
  ["Faut-il déjà avoir un compte Instagram pro ?", "Oui. KLIP se connecte à un compte Instagram professionnel ou créateur via l’API officielle. La connexion prend deux minutes, par client."],
  ["L’IA respecte-t-elle vraiment la voix de chaque marque ?", "Vous définissez le ton, le style et les mots interdits de chaque client une fois. Chaque génération s’appuie sur cette voix — vous gardez la main et peaufinez d’un clic."],
  ["Mes clients peuvent-ils valider sans compte KLIP ?", "Oui. Vous envoyez un lien de validation : le client approuve ou commente directement, sans rien installer. Fini les allers-retours par mail."],
  ["Mes données clients sont-elles cloisonnées ?", "Chaque client a son espace : charte, historique, comptes connectés. Rien n’est mélangé entre deux marques, jamais."],
  ["Puis-je changer d’offre en cours de route ?", "À tout moment, sans engagement. Vous montez d’un palier quand vous prenez plus de clients, et redescendez si besoin."],
];

const faqLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map(([q, a]) => ({
    "@type": "Question",
    name: q,
    acceptedAnswer: { "@type": "Answer", text: a },
  })),
};

// Version française de la page d'accueil, en mode normal (pas liste d'attente).
// On force un provider next-intl en 'fr' autour de la vue (le provider le plus
// proche l'emporte sur celui du layout racine), indépendamment du cookie de
// langue. La variante française en liste d'attente vit sur /acces-anticipe ;
// l'accueil racine « / » reste en anglais pour l'audience internationale.
export default async function Page() {
  // Places de lancement restantes : la landing doit afficher le même état que
  // la caisse, sinon elle annoncerait une remise que le paiement n'accorde pas.
  const seatsLeft = await launchSeatsLeft();
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <I18nProvider locale="fr" messages={getMessages("fr")}>
        <LandingView seatsLeft={seatsLeft} />
      </I18nProvider>
    </>
  );
}
