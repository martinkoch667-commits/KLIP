/** @type {import("next").NextConfig} */
// En-têtes de sécurité appliqués à toutes les réponses (point sécurité 16 + durcissement).
const securityHeaders = [
  // Force HTTPS pendant 2 ans (HSTS). Vercel sert déjà en HTTPS.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Empêche le MIME-sniffing.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Anti-clickjacking : le site ne peut pas être embarqué dans une iframe tierce.
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Coupe l'accès aux capteurs sensibles par défaut. Le micro reste ouvert à
  // KLIP seul (self) : la dictée vocale en dépend, et un `microphone=()` global
  // la bloquait en production ("Permissions policy violation" en console) —
  // les iframes tierces, elles, n'y ont toujours pas droit.
  { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig = {
  poweredByHeader: false, // ne pas divulguer "X-Powered-By: Next.js"
  images: {
    // Les vignettes passent par /_next/image en pointant sur /api/proxy-image
    // (une URL locale, donc autorisée sans remotePatterns). Sans cette étape le
    // navigateur décodait les photos en pleine résolution — quelques dizaines
    // de mégaoctets par vignette, jusqu'au rechargement de l'onglet par Safari.
    // Les largeurs demandées doivent figurer ici, sinon l'optimiseur répond 400.
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 320, 384, 480],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    formats: ["image/webp"],
    minimumCacheTTL: 3600,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  webpack: (config) => {
    config.externals = [...(config.externals || []), { canvas: 'canvas' }];
    return config;
  },
};
// `fonteditor-core` embarque un module WebAssembly pour le WOFF2 que la route de
// réparation n'utilise pas (elle écrit du TTF). Le laisser passer par le
// bundler produit un avertissement « Critical dependency » et embarque du code
// mort ; on la charge donc comme un paquet Node ordinaire, côté serveur.
nextConfig.experimental = {
  ...(nextConfig.experimental ?? {}),
  serverComponentsExternalPackages: [
    ...((nextConfig.experimental && nextConfig.experimental.serverComponentsExternalPackages) || []),
    'fonteditor-core',
  ],
};

module.exports = nextConfig;
