import type { Metadata } from "next";
import LandingView from "./landing-v3";
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import { getMessages } from "@/lib/i18n/messages";

export const metadata: Metadata = {
  title: "Klip — The all-in-one tool for agencies managing multiple Instagram clients",
  description:
    "Visual creation, AI captions, scheduling and client approval. Klip brings all your clients' Instagram content production into one tool. 7-day free trial.",
  keywords:
    "community manager tool, agency social media management, instagram scheduling, client approval, multiple instagram accounts",
  authors: [{ name: "Klip" }],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://getklip.fr",
    siteName: "Klip",
    title: "Klip — The all-in-one social studio for agencies",
    description:
      "Visual creation, AI captions, scheduling and client approval — all in one tool.",
    // image fournie par app/opengraph-image.tsx (route dynamique)
  },
  twitter: {
    card: "summary_large_image",
    title: "Klip — The social studio for agencies & community managers",
    description: "All your clients' Instagram content production in one tool.",
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
    "Klip is the all-in-one social studio for agencies and community managers: visual editor, AI captions, video editing, calendar and automatic Instagram publishing.",
};

const websiteLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Klip",
  url: SITE,
  inLanguage: ["en", "fr"],
  publisher: { "@type": "Organization", name: "Klip", url: SITE },
};

const softwareLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Klip",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: SITE,
  inLanguage: "en",
  description:
    "All-in-one Instagram content creation and scheduling tool for agencies: visual editor, AI captions, calendar, client approval and automatic publishing.",
  featureList: [
    "Visual editor for posts and carousels",
    "AI captions generated in each client's brand voice",
    "Video editing (subtitles, transitions, auto assembly)",
    "Editorial calendar and scheduling",
    "Client approval via link, no account needed",
    "Automatic Instagram publishing",
    "Siloed multi-client management",
  ],
  offers: [
    { "@type": "Offer", name: "Studio", price: "35.00", priceCurrency: "EUR", category: "subscription" },
    { "@type": "Offer", name: "Agence", price: "96.00", priceCurrency: "EUR", category: "subscription" },
  ],
};

// Reprend les questions/réponses réelles de la section FAQ de la landing (EN)
const FAQ = [
  ["Do I need to already have a pro Instagram account?", "Yes. KLIP connects to a professional or creator Instagram account via the official API. Connecting takes two minutes, per client."],
  ["Does the AI really respect each brand’s voice?", "You define the tone, style and banned words for each client once. Every generation draws on that voice — you stay in control and refine in one click."],
  ["Can my clients approve without a KLIP account?", "Yes. You send an approval link: the client approves or comments directly, with nothing to install. No more email back-and-forth."],
  ["Is my client data siloed?", "Each client has its own space: brand kit, history, connected accounts. Nothing is ever mixed between two brands."],
  ["Can I change plans along the way?", "Anytime, no commitment. You move up a tier when you take on more clients, and back down if needed."],
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

// La page d'accueil est TOUJOURS en anglais (audience internationale), quel que
// soit le cookie de langue : provider next-intl forcé en 'en' (le plus proche
// l'emporte sur celui du layout racine). La version française en mode liste
// d'attente vit sur /acces-anticipe.
export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <I18nProvider locale="en" messages={getMessages("en")}>
        <LandingView />
      </I18nProvider>
    </>
  );
}
