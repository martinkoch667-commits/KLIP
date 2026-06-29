import type { Metadata } from "next";
import LandingView from "../landing-view";

const SITE = "https://getklip.fr";

export const metadata: Metadata = {
  title: "Accès anticipé à Klip — L'outil tout-en-un pour gérer l'Instagram de vos clients",
  description: "Inscrivez-vous à la liste d'attente de Klip : accès prioritaire, tarif fondateur et onboarding offert pour les premiers inscrits.",
  alternates: { canonical: "/acces-anticipe" },
  openGraph: {
    title: "Accès anticipé à Klip",
    description: "Rejoignez la liste d'attente : accès prioritaire, tarif fondateur et onboarding offert.",
    url: `${SITE}/acces-anticipe`,
    type: "website",
  },
};

export default function Page() {
  return <LandingView prelaunch />;
}
