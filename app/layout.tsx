import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import MetaPixel from "@/components/analytics/MetaPixel";
import ConsentBanner from "@/components/analytics/ConsentBanner";
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import { LOCALE_COOKIE, resolveLocale } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";

export const metadata: Metadata = {
  metadataBase: new URL("https://getklip.fr"),
  title: {
    default: "Klip — Le studio social pour agences & community managers",
    template: "%s | Klip",
  },
  description:
    "Klip réunit l'éditeur visuel, la génération de légendes par IA, le calendrier et la publication automatique Instagram en un seul endroit. Gérez tous vos clients depuis un même espace.",
  keywords: [
    "agence social media",
    "community manager",
    "publication Instagram automatique",
    "planification réseaux sociaux",
    "légendes IA Instagram",
    "gestion multi-clients",
    "calendrier éditorial",
    "création contenu Instagram",
    "outil social media agence",
    "Klip",
  ],
  authors: [{ name: "Klip" }],
  creator: "Klip",
  publisher: "Klip",
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "Klip",
    title: "Klip — Le studio social pour agences & community managers",
    description:
      "Créez, planifiez et publiez le contenu de tous vos clients Instagram depuis un seul espace. Éditeur visuel, légendes IA, calendrier et publication automatique.",
    // image fournie par app/opengraph-image.tsx (route dynamique)
  },
  twitter: {
    card: "summary_large_image",
    title: "Klip — Le studio social pour agences & community managers",
    description:
      "Créez, planifiez et publiez le contenu de tous vos clients Instagram depuis un seul espace. Éditeur visuel, légendes IA, calendrier et publication automatique.",
  },
  icons: {
    // L'icône d'app (le K sur fond vert) plutôt que le logo écrit, illisible
    // sous 32 px. `?v=2` force les navigateurs à relâcher l'ancienne : un
    // favicon est mis en cache très longtemps, et le nom de fichier n'a pas
    // changé.
    icon: [
      { url: "/favicon-32.png?v=2", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png?v=2", sizes: "192x192", type: "image/png" },
    ],
    apple: "/icon-192.png?v=2",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0C2A1D",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = resolveLocale(cookies().get(LOCALE_COOKIE)?.value);
  const messages = getMessages(locale);
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        {/* Restore saved theme before first paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('klip-theme')||'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`,
          }}
        />
        {/* Fonts */}
        <link rel="preconnect" href="https://api.fontshare.com" />
        {/* Early Sans Variable (Adobe Fonts) — replaces Satoshi + Cabinet Grotesk for UI */}
        <link rel="stylesheet" href="https://use.typekit.net/pgn2gxc.css" />
        {/* Keep Satoshi + Cabinet Grotesk for canvas font presets in editor */}
        <link href="https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@800,700,500,400&f[]=satoshi@700,500,400&f[]=gambetta@700,400i&display=swap" rel="stylesheet" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Archivo:ital,wght@0,400;0,700;0,800;1,700;1,800&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased">
        <I18nProvider locale={locale} messages={messages}>
          <MetaPixel />
          {children}
          <ConsentBanner />
        </I18nProvider>
      </body>
    </html>
  );
}
