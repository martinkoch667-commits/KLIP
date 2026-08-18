import type { Metadata } from "next";
import LandingView from "./landing-v3";
import { getMessages } from "@/lib/i18n/messages";
import { launchSeatsLeft } from "@/lib/launch-seats";

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
    "Klip est le studio social tout-en-un des agences et community managers : éditeur visuel, descriptions IA, montage vidéo, calendrier et publication automatique sur Instagram.",
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
    "Outil tout-en-un de création et de planification de contenu Instagram pour agences : éditeur visuel, descriptions IA, calendrier, validation client et publication automatique.",
  featureList: [
    "Éditeur visuel pour posts et carrousels",
    "Descriptions IA écrites dans la voix de chaque marque",
    "Montage vidéo (sous-titres, transitions, assemblage automatique)",
    "Calendrier éditorial et planification",
    "Validation client par lien, sans création de compte",
    "Publication automatique sur Instagram",
    "Gestion multi-clients cloisonnée",
  ],
  offers: [
    { "@type": "Offer", name: "Studio", price: "35.00", priceCurrency: "EUR", category: "subscription" },
    { "@type": "Offer", name: "Agence", price: "96.00", priceCurrency: "EUR", category: "subscription" },
  ],
};

// Les questions/réponses sont lues dans le catalogue de traduction plutôt que
// recopiées ici : la FAQ affichée et celle déclarée à Google ne peuvent plus
// diverger quand l'une des deux est retouchée.
const faqCopy = getMessages("fr").landing.faq;
const FAQ: [string, string][] = [
  [faqCopy.q1, faqCopy.a1],
  [faqCopy.q2, faqCopy.a2],
  [faqCopy.q3, faqCopy.a3],
  [faqCopy.q4, faqCopy.a4],
  [faqCopy.q5, faqCopy.a5],
  [faqCopy.qMontage, faqCopy.aMontage],
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

// La page d'accueil suit la langue du visiteur comme le reste du site (cookie
// klip-locale, français à défaut) : plus de provider forcé en anglais ici — le
// sélecteur de langue fonctionne donc aussi sur l'accueil. La version en mode
// liste d'attente vit toujours sur /acces-anticipe.
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
      <LandingView seatsLeft={seatsLeft} />
    </>
  );
}
