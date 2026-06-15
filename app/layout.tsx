import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Klip",
  description: "Production de contenu client, simplifiée.",
  icons: {
    icon: "/favicon-32.png",
    apple: "/icon-192.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
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
        {children}
      </body>
    </html>
  );
}
