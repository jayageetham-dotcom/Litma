import type { MetadataRoute } from "next";
import { DEFAULT_DESCRIPTION, SITE_NAME } from "@/lib/seo";

export const dynamic = "force-static";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** /manifest.webmanifest: lets phones and Chrome install Litma as an app from the website. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: `${BASE}/`,
    name: "Litma · മലയാളം എഴുത്തുമേശ",
    short_name: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    lang: "ml",
    dir: "ltr",
    start_url: `${BASE}/desk/`,
    scope: `${BASE}/`,
    display: "standalone",
    orientation: "any",
    background_color: "#f5f4f9",
    theme_color: "#111113",
    categories: ["productivity", "books", "education", "utilities"],
    icons: [
      { src: `${BASE}/icons/icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `${BASE}/icons/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `${BASE}/icons/icon-maskable-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Your desk", short_name: "Desk", url: `${BASE}/desk/`, icons: [{ src: `${BASE}/icons/icon-192.png`, sizes: "192x192" }] },
      { name: "Dictionary · നിഘണ്ടു", short_name: "Dictionary", url: `${BASE}/dictionary/`, icons: [{ src: `${BASE}/icons/icon-192.png`, sizes: "192x192" }] },
    ],
  };
}
