import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo";

export const dynamic = "force-static";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** /robots.txt: the public pages are open to search engines; writers' own pages are not. */
export default function robots(): MetadataRoute.Robots {
  const privatePages = ["/desk/", "/write/", "/read/", "/book/", "/print/", "/profile/", "/settings/", "/admin/", "/auth/", "/reset-password/", "/forgot-password/", "/mcp", "/downloads/"];
  return {
    rules: [{ userAgent: "*", allow: `${BASE}/`, disallow: privatePages.map((p) => `${BASE}${p}`) }],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
