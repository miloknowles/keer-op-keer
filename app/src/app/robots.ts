import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: "/room/" }],
    sitemap: "https://keer2.vercel.app/sitemap.xml",
  };
}
