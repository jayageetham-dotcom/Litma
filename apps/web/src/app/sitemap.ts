import type { MetadataRoute } from "next";
import { PUBLIC_PAGES, SITE } from "@/lib/seo";

export const dynamic = "force-static";

/** /sitemap.xml: the public pages (everything else needs sign-in). */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return PUBLIC_PAGES.map((p) => ({ url: `${SITE}${p.path}`, lastModified, changeFrequency: p.changeFrequency, priority: p.priority }));
}
