import type { Metadata } from "next";
import LandingView from "./landing-v3";

export const metadata: Metadata = {
  title: "Klip — L'outil tout-en-un pour agences qui gèrent plusieurs clients Instagram",
  description:
    "Création visuelle, descriptions IA, planification et validation client. Klip réunit toute la production de contenu Instagram de vos clients dans un seul outil. Essai gratuit 7 jours.",
  keywords:
    "outil community manager, gestion réseaux sociaux agence, planification instagram, validation client, plusieurs comptes instagram",
  authors: [{ name: "Klip" }],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: "https://getklip.fr",
    siteName: "Klip",
    title: "Klip — Le studio social tout-en-un pour agences",
    description:
      "Création visuelle, descriptions IA, planification et validation client — tout dans un seul outil.",
    // image fournie par app/opengraph-image.tsx (route dynamique)
  },
  twitter: {
    card: "summary_large_image",
    title: "Klip — Le studio social pour agences & community managers",
    description: "Toute la production de contenu Instagram de vos clients dans un seul outil.",
  },
  robots: { index: true, follow: true },
};

const SITE = "https://getklip.fr";

const organizationLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Klip",
  url: SITE,
  logo: `${SITE}/logo-klip-dark.png`,
  description:
    "Klip est le studio social tout-en-un pour agences et community managers : éditeur visuel, légendes IA, éditeur de montage vidéo, calendrier et publication automatique Instagram.",
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
  url: SITE,
  inLanguage: "fr",
  description:
    "Outil tout-en-un de création et planification de contenu Instagram pour agences de communication : éditeur visuel, descriptions IA, calendrier, validation client et publication automatique.",
  featureList: [
    "Éditeur visuel de posts et carrousels",
    "Génération de légendes par IA à la charte du client",
    "Éditeur de montage vidéo (sous-titres, transitions, montage auto)",
    "Calendrier éditorial et planification",
    "Validation client par lien, sans compte",
    "Publication automatique Instagram",
    "Gestion multi-clients cloisonnée",
  ],
  offers: [
    { "@type": "Offer", name: "Studio", price: "35.00", priceCurrency: "EUR", category: "subscription" },
    { "@type": "Offer", name: "Agence", price: "96.00", priceCurrency: "EUR", category: "subscription" },
  ],
};

// Reprend les questions/réponses réelles de la section FAQ de la landing
const FAQ = [
  ["Faut-il déjà avoir un compte Instagram pro ?", "Oui. Klip se connecte à un compte Instagram professionnel ou créateur via l’API officielle. La connexion prend deux minutes, par client."],
  ["L’IA respecte-t-elle vraiment la voix de chaque marque ?", "Vous définissez le ton, le style et les mots interdits de chaque client une fois. Chaque génération s’appuie sur cette voix — vous gardez la main et peaufinez d’un clic."],
  ["Mes clients peuvent-ils valider sans compte Klip ?", "Oui. Vous envoyez un lien de validation : le client approuve ou commente directement, sans rien installer. Fini les allers-retours par mail."],
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

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <LandingView prelaunch />
    </>
  );
}
