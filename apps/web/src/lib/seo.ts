import type { Metadata } from "next";

/**
 * Search and share details (title, description, Open Graph / Twitter cards, canonical URL).
 * Server-only helpers for `export const metadata` in pages and route layouts.
 */

/** the public address, used for canonical links, the sitemap and share cards */
export const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://getlitma.in").replace(/\/$/, "");
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const SITE_NAME = "Litma";
export const SITE_NAME_ML = "ലിറ്റ്മ";
export const DEFAULT_TITLE = "Litma · Malayalam writing app | മലയാളം എഴുത്തുമേശ";
export const DEFAULT_DESCRIPTION =
  "Litma is a writing desk for Malayalam literature. Write novels, short stories, poems, screenplays and features on real A4 pages, typing in Manglish or Malayalam, with a built-in Malayalam dictionary, Story World and book PDFs.";

export const SHARE_IMAGE = {
  url: `${BASE}/og-image.jpg`,
  width: 1200,
  height: 630,
  alt: "Litma: എഴുതൂ, മലയാളത്തിൽ. A writing desk for Malayalam literature.",
  type: "image/jpeg",
};

export const KEYWORDS = [
  "Malayalam writing app",
  "Malayalam typing",
  "Manglish to Malayalam",
  "Malayalam editor",
  "Malayalam novel writing",
  "Malayalam screenplay",
  "Malayalam poem",
  "Malayalam dictionary",
  "Malayalam thesaurus",
  "Malayalam book PDF",
  "മലയാളം എഴുത്ത്",
  "മലയാളം ടൈപ്പിങ്",
  "മലയാളം നിഘണ്ടു",
  "മംഗ്ലീഷ്",
  "തിരക്കഥ",
  "നോവൽ",
  "കവിത",
  "Litma",
  "ലിറ്റ്മ",
];

type PageMeta = {
  /** shown as "<title> · Litma" */
  title?: string;
  description?: string;
  /** path from the site root with a trailing slash, e.g. "/download/" */
  path: string;
  /** pages behind sign-in, or that only make sense with a query string, stay out of search */
  noindex?: boolean;
};

/** Metadata for one page: title, description, canonical URL and matching share cards. */
export function pageMetadata({ title, description = DEFAULT_DESCRIPTION, path, noindex }: PageMeta): Metadata {
  const shareTitle = title ? `${title} · ${SITE_NAME}` : DEFAULT_TITLE;
  if (noindex) return { title, description, robots: { index: false, follow: false } };
  return {
    ...(title ? { title } : {}),
    description,
    alternates: { canonical: `${BASE}${path}` },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: "ml_IN",
      alternateLocale: ["en_IN"],
      url: `${BASE}${path}`,
      title: shareTitle,
      description,
      images: [SHARE_IMAGE],
    },
    twitter: { card: "summary_large_image", title: shareTitle, description, images: [SHARE_IMAGE.url] },
  };
}

/** Pages listed in sitemap.xml (public, indexable). */
export const PUBLIC_PAGES: { path: string; priority: number; changeFrequency: "daily" | "weekly" | "monthly" | "yearly" }[] = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/dictionary/", priority: 0.8, changeFrequency: "weekly" },
  { path: "/download/", priority: 0.7, changeFrequency: "weekly" },
  { path: "/help/", priority: 0.7, changeFrequency: "weekly" },
  { path: "/signup/", priority: 0.5, changeFrequency: "yearly" },
  { path: "/login/", priority: 0.3, changeFrequency: "yearly" },
  { path: "/privacy/", priority: 0.3, changeFrequency: "yearly" },
  { path: "/terms/", priority: 0.3, changeFrequency: "yearly" },
];
