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
    default: "Klip — The social studio for agencies & community managers",
    template: "%s | Klip",
  },
  description:
    "Klip brings the visual editor, AI caption generation, the calendar and automatic Instagram publishing together in one place. Manage all your clients from a single workspace.",
  keywords: [
    "social media agency",
    "community manager",
    "automatic Instagram publishing",
    "social media scheduling",
    "AI Instagram captions",
    "multi-client management",
    "editorial calendar",
    "Instagram content creation",
    "agency social media tool",
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
    locale: "en_US",
    siteName: "Klip",
    title: "Klip — The social studio for agencies & community managers",
    description:
      "Create, schedule and publish content for all your Instagram clients from a single workspace. Visual editor, AI captions, calendar and automatic publishing.",
    // image fournie par app/opengraph-image.tsx (route dynamique)
  },
  twitter: {
    card: "summary_large_image",
    title: "Klip — The social studio for agencies & community managers",
    description:
      "Create, schedule and publish content for all your Instagram clients from a single workspace. Visual editor, AI captions, calendar and automatic publishing.",
  },
  icons: {
    icon: "/favicon-32.png",
    apple: "/icon-192.png",
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
    <html lang={locale}>
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
