import type { Metadata } from "next";
import LandingView from "../landing-view";
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import { getMessages } from "@/lib/i18n/messages";

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

// Cette page reste en FRANÇAIS uniquement, quelle que soit la langue par défaut
// du site : on force un provider next-intl en 'fr' autour de la vue (le provider
// le plus proche l'emporte sur celui du layout racine).
export default function Page() {
  return (
    <I18nProvider locale="fr" messages={getMessages("fr")}>
      <LandingView prelaunch />
    </I18nProvider>
  );
}
