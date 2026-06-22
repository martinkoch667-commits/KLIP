import type { Metadata } from "next";
import LandingView from "./landing-view";

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
    url: "https://klip-swart.vercel.app",
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

export default function Page() {
  return <LandingView />;
}
