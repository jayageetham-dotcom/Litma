import type { MetadataRoute } from "next";
import { allGuides } from "@/lib/help";
import { PUBLIC_PAGES, SITE } from "@/lib/seo";

export const dynamic = "force-static";

/** /sitemap.xml: the public pages (everything else needs sign-in). */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const pages = PUBLIC_PAGES.map((p) => ({ url: `${SITE}${p.path}`, lastModified, changeFrequency: p.changeFrequency, priority: p.priority }));
  // every help guide has its own page (app/help/[id])
  const guides = allGuides().map((a) => ({ url: `${SITE}/help/${a.id}/`, lastModified, changeFrequency: "monthly" as const, priority: 0.5 }));
  return [...pages, ...guides];
}
