import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/workspace/",
        "/dashboard",
        "/preview/",
        "/onboarding",
        "/abonnement",
        "/settings",
        "/calendar",
        "/composer",
        "/feed",
        "/templates",
      ],
    },
    sitemap: "https://getklip.fr/sitemap.xml",
  };
}
