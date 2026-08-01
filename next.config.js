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
module.exports = nextConfig;
